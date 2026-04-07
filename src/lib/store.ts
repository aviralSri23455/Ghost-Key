import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/AuthContext";
import { apiUrl, readJsonResponse } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";

export type ServiceId = "google_calendar" | "gmail" | "slack";
export type ServiceStatus = "disconnected" | "connecting" | "connected" | "error";
export type ServiceHealthStatus = "connected" | "expired" | "revoked";
export type VaultMode = "real" | "fallback";
export type CIBAStatus = "idle" | "pending" | "approved" | "denied" | "timeout";
const AUTO_CONNECT_SERVICE_IDS: ServiceId[] = ["google_calendar", "gmail", "slack"];
type PendingAction = { service: ServiceId; action: string; context?: string; requestId?: string };
const RESET_MODE_STORAGE_KEY = "ghostkey-reset-mode";

export interface ServiceConnection {
  id: ServiceId;
  name: string;
  icon: string;
  status: ServiceStatus;
  healthStatus: ServiceHealthStatus;
  vaultMode: VaultMode;
  auth0Connection: string | null;
  scopes: string[];
  grantedScopes: string[];
  sensitiveActions: string[];
  lastUsed: Date | null;
  connectedAt: Date | null;
  lastRefreshed: Date | null;
  nextExpiry: Date | null;
}

export interface AuditEntry {
  id: string;
  timestamp: Date;
  service: ServiceId;
  action: string;
  userId: string;
  tokenHash: string;
  result: "success" | "blocked" | "revoked" | "step_up_approved" | "step_up_denied" | "error";
  stepUp: boolean;
  details?: string;
}

export interface SensitiveActions {
  [service: string]: string[];
}

export interface VaultHealth {
  vault: "connected" | "disconnected";
  mode: VaultMode;
  connectedServices: number;
  checkedAt: Date | null;
}

export const defaultSensitiveActions: SensitiveActions = {
  gmail: ["send_mass_email", "delete_thread", "send_with_attachment_over_5mb"],
  google_calendar: ["delete_all_events", "share_calendar_externally"],
  slack: ["post_to_public_channel", "send_dm_to_all_members"],
};

type ServiceRow = Tables<"services_state">;
type AuditRow = Tables<"audit_log">;
type ServiceApiRow = ServiceRow & {
  auth0_connection?: string | null;
  vault_mode?: VaultMode;
  health_status?: ServiceHealthStatus;
  last_refreshed?: string | null;
  next_expiry?: string | null;
};

function normalizeStringArray(value: unknown, fallback: string[] = []): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [...fallback];
}

function mapDbService(row: ServiceApiRow): ServiceConnection {
  const defaultActions = defaultSensitiveActions[row.id as ServiceId] || [];

  return {
    id: row.id as ServiceId,
    name: row.name,
    icon: row.icon,
    status: row.status as ServiceStatus,
    healthStatus: row.health_status || (row.status === "connected" ? "connected" : "revoked"),
    vaultMode: row.vault_mode || "fallback",
    auth0Connection: row.auth0_connection || null,
    scopes: normalizeStringArray(row.scopes),
    grantedScopes: normalizeStringArray(row.granted_scopes),
    sensitiveActions: normalizeStringArray(row.sensitive_actions, defaultActions),
    lastUsed: row.last_used ? new Date(row.last_used) : null,
    connectedAt: row.connected_at ? new Date(row.connected_at) : null,
    lastRefreshed: row.last_refreshed ? new Date(row.last_refreshed) : null,
    nextExpiry: row.next_expiry ? new Date(row.next_expiry) : null,
  };
}

function mapDbAudit(row: AuditRow): AuditEntry {
  return {
    id: row.id,
    timestamp: new Date(row.created_at),
    service: row.service as ServiceId,
    action: row.action,
    userId: row.user_id,
    tokenHash: row.token_hash,
    result: row.result as AuditEntry["result"],
    stepUp: row.step_up,
    details: row.details,
  };
}

function mapSensitiveActionsConfig(payload: unknown): SensitiveActions {
  if (!payload || typeof payload !== "object" || !("services" in payload)) {
    return { ...defaultSensitiveActions };
  }

  const services = payload.services;
  if (!services || typeof services !== "object") {
    return { ...defaultSensitiveActions };
  }

  const nextConfig: SensitiveActions = {};

  Object.entries(services as Record<string, unknown>).forEach(([serviceId, value]) => {
    nextConfig[serviceId] = normalizeStringArray(
      value,
      defaultSensitiveActions[serviceId] || [],
    );
  });

  return { ...defaultSensitiveActions, ...nextConfig };
}

function mapVaultHealth(payload: unknown): VaultHealth {
  if (!payload || typeof payload !== "object") {
    return {
      vault: "disconnected",
      mode: "fallback",
      connectedServices: 0,
      checkedAt: null,
    };
  }

  const response = payload as {
    vault?: "connected" | "disconnected";
    mode?: VaultMode;
    connected_services?: number;
    timestamp?: string;
  };

  return {
    vault: response.vault || "disconnected",
    mode: response.mode || "fallback",
    connectedServices: typeof response.connected_services === "number" ? response.connected_services : 0,
    checkedAt: response.timestamp ? new Date(response.timestamp) : null,
  };
}

function mergeSensitiveActionsIntoServices(services: ServiceConnection[], config: SensitiveActions) {
  return services.map((service) => ({
    ...service,
    sensitiveActions: config[service.id] || service.sensitiveActions,
  }));
}

function logBackgroundRefreshError(error: unknown) {
  console.error("GhostKey background refresh failed:", error);
}

function isResetModeEnabled() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(RESET_MODE_STORAGE_KEY) === "true";
}

function setResetModeEnabled(enabled: boolean) {
  if (typeof window === "undefined") return;

  if (enabled) {
    window.localStorage.setItem(RESET_MODE_STORAGE_KEY, "true");
    return;
  }

  window.localStorage.removeItem(RESET_MODE_STORAGE_KEY);
}

export function useGhostKeyStore() {
  const { user, getAccessToken } = useAuth();
  const [services, setServices] = useState<ServiceConnection[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [optimisticAuditLog, setOptimisticAuditLog] = useState<AuditEntry[]>([]);
  const [serviceOverrides, setServiceOverrides] = useState<Partial<Record<ServiceId, Partial<ServiceConnection>>>>({});
  const [sensitiveActions, setSensitiveActions] = useState<SensitiveActions>(defaultSensitiveActions);
  const [vaultHealth, setVaultHealth] = useState<VaultHealth>({
    vault: "disconnected",
    mode: "fallback",
    connectedServices: 0,
    checkedAt: null,
  });
  const [cibaStatus, setCibaStatus] = useState<CIBAStatus>("idle");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [loading, setLoading] = useState(true);
  const cibaTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoConnectAttemptedRef = useRef(false);

  const apiFetchWithUser = useCallback(async (path: string, options?: RequestInit) => {
    const headers = new Headers(options?.headers || {});
    const token = await getAccessToken();

    headers.set("Content-Type", "application/json");

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    if (user?.email) {
      headers.set("x-user-email", user.email);
    }

    if (isResetModeEnabled()) {
      headers.set("x-ghostkey-reset-mode", "true");
    }

    return fetch(apiUrl(path), {
      ...options,
      headers,
    });
  }, [getAccessToken, user?.email]);

  const applyServiceOverrides = useCallback((nextServices: ServiceConnection[]) => {
    return nextServices.map((service) => ({
      ...service,
      ...(serviceOverrides[service.id] || {}),
    }));
  }, [serviceOverrides]);

  const refetchAudit = useCallback(async () => {
    const res = await apiFetchWithUser("audit");
    if (!res.ok) return;

    const data = await readJsonResponse<AuditRow[]>(res);
    const fetched = data.map(mapDbAudit);

    setOptimisticAuditLog((prevOptimistic) => {
      const merged = [...prevOptimistic, ...fetched].filter(
        (entry, index, array) => array.findIndex((item) => item.id === entry.id) === index,
      );
      merged.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setAuditLog(merged);
      return prevOptimistic;
    });
  }, [apiFetchWithUser]);

  const refetchServices = useCallback(async () => {
    const res = await apiFetchWithUser("services");
    if (!res.ok) return;

    const data = await readJsonResponse<ServiceApiRow[]>(res);
    const mapped = data.map((row: ServiceApiRow) => mapDbService(row));
    const withOverrides = applyServiceOverrides(mapped);
    setServices(mergeSensitiveActionsIntoServices(withOverrides, sensitiveActions));
  }, [apiFetchWithUser, applyServiceOverrides, sensitiveActions]);

  const refetchSensitiveActions = useCallback(async () => {
    const res = await apiFetchWithUser("config/sensitive-actions");
    if (!res.ok) return;

    const data = await readJsonResponse<unknown>(res);
    const nextConfig = mapSensitiveActionsConfig(data);
    setSensitiveActions(nextConfig);
    setServices((prev) => mergeSensitiveActionsIntoServices(prev, nextConfig));
  }, [apiFetchWithUser]);

  const refetchHealth = useCallback(async () => {
    const res = await apiFetchWithUser("agent/health");
    if (!res.ok) return;

    const data = await readJsonResponse<unknown>(res);
    setVaultHealth(mapVaultHealth(data));
  }, [apiFetchWithUser]);

  useEffect(() => {
    async function load() {
      try {
        await Promise.all([
          refetchServices(),
          refetchAudit(),
          refetchSensitiveActions(),
          refetchHealth(),
        ]);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load GhostKey data.";
        console.error("GhostKey initial load failed:", error);
        toast.error(message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [refetchAudit, refetchHealth, refetchSensitiveActions, refetchServices]);

  useEffect(() => {
    if (loading || autoConnectAttemptedRef.current) return;
    if (!user) return;
    if (!services.length) return;
    if (isResetModeEnabled()) {
      autoConnectAttemptedRef.current = true;
      return;
    }

    const hasConnectedService = services.some((service) => service.status === "connected");
    if (hasConnectedService) {
      autoConnectAttemptedRef.current = true;
      return;
    }

    autoConnectAttemptedRef.current = true;

    void (async () => {
      try {
        await Promise.all(
          AUTO_CONNECT_SERVICE_IDS.map((serviceId) =>
            apiFetchWithUser(`auth/connect/${serviceId}`, { method: "POST" }),
          ),
        );

        await Promise.all([
          refetchServices(),
          refetchAudit(),
          refetchSensitiveActions(),
          refetchHealth(),
        ]);
      } catch (error) {
        console.error("GhostKey auto-connect failed:", error);
      }
    })();
  }, [
    apiFetchWithUser,
    loading,
    refetchAudit,
    refetchHealth,
    refetchSensitiveActions,
    refetchServices,
    services,
    user,
  ]);

  const realtimeSetup = useRef(false);
  useEffect(() => {
    if (realtimeSetup.current) return;
    realtimeSetup.current = true;

    const auditChannel = supabase
      .channel("realtime-audit")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_log" },
        (payload) => {
          const newEntry = mapDbAudit(payload.new as AuditRow);
          setAuditLog((prev) => {
            if (prev.some((entry) => entry.id === newEntry.id)) return prev;
            return [newEntry, ...prev];
          });
        },
      )
      .subscribe();

    const servicesChannel = supabase
      .channel("realtime-services")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "services_state" },
        () => {
          void Promise.all([
            refetchServices(),
            refetchSensitiveActions(),
            refetchHealth(),
          ]).catch(logBackgroundRefreshError);
        },
      )
      .subscribe();

    const intervalId = window.setInterval(() => {
      void Promise.all([
        refetchAudit(),
        refetchServices(),
        refetchSensitiveActions(),
        refetchHealth(),
      ]).catch(logBackgroundRefreshError);
    }, 15000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void Promise.all([
          refetchAudit(),
          refetchServices(),
          refetchSensitiveActions(),
          refetchHealth(),
        ]).catch(logBackgroundRefreshError);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      supabase.removeChannel(auditChannel);
      supabase.removeChannel(servicesChannel);
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      realtimeSetup.current = false;
    };
  }, [refetchAudit, refetchHealth, refetchSensitiveActions, refetchServices]);

  const connectService = useCallback(async (serviceId: ServiceId) => {
    setResetModeEnabled(false);
    autoConnectAttemptedRef.current = true;
    setServiceOverrides((prev) => {
      const next = { ...prev };
      delete next[serviceId];
      return next;
    });

    setServices((prev) =>
      prev.map((service) =>
        service.id === serviceId ? { ...service, status: "connecting" as ServiceStatus } : service,
      ),
    );

    try {
      const response = await apiFetchWithUser(`auth/connect/${serviceId}`, { method: "POST" });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(`Failed to connect ${serviceId}: ${errorText}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to connect ${serviceId}.`;
      toast.error(message);
      throw error;
    } finally {
      await Promise.all([refetchAudit(), refetchServices(), refetchSensitiveActions(), refetchHealth()]);
    }
  }, [apiFetchWithUser, refetchAudit, refetchHealth, refetchSensitiveActions, refetchServices]);

  const revokeService = useCallback(async (serviceId: ServiceId) => {
    const response = await apiFetchWithUser(`services/${serviceId}`, { method: "DELETE" });

    if (response.ok) {
      const payload = await readJsonResponse<{ status?: string }>(response);

      if (payload?.status === "revoked") {
        const timestamp = new Date();

        setServiceOverrides((prev) => ({
          ...prev,
          [serviceId]: {
            status: "disconnected",
            healthStatus: "revoked",
            grantedScopes: [],
            connectedAt: null,
            lastUsed: null,
            lastRefreshed: null,
          },
        }));

        setServices((prev) =>
          prev.map((service) =>
            service.id === serviceId
              ? {
                  ...service,
                  status: "disconnected",
                  healthStatus: "revoked",
                  grantedScopes: [],
                  connectedAt: null,
                  lastUsed: null,
                  lastRefreshed: null,
                }
              : service,
          ),
        );

        const optimisticEntry: AuditEntry = {
          id: `optimistic-revoke-${serviceId}-${timestamp.getTime()}`,
          timestamp,
          service: serviceId,
          action: "revoke_token",
          userId: user?.email || user?.id || "auth0-user",
          tokenHash: "pending",
          result: "revoked",
          stepUp: false,
          details: "Service revoked from dashboard. Waiting for backend audit confirmation.",
        };

        setOptimisticAuditLog((prev) => [optimisticEntry, ...prev]);
        setAuditLog((prev) => [optimisticEntry, ...prev]);
      }
    }

    await Promise.all([refetchAudit(), refetchServices(), refetchSensitiveActions(), refetchHealth()]);
  }, [apiFetchWithUser, refetchAudit, refetchHealth, refetchSensitiveActions, refetchServices, user?.email, user?.id]);

  const executeAction = useCallback(async (serviceId: ServiceId, action: string, params?: Record<string, unknown>) => {
    const res = await apiFetchWithUser("agent/act", {
      method: "POST",
      body: JSON.stringify({ service: serviceId, action, params }),
    });

    if (res.status === 202) {
      const payload = await readJsonResponse<{ request_id?: string }>(res);
      setCibaStatus("pending");
      setPendingAction({
        service: serviceId,
        action,
        context: JSON.stringify(params),
        requestId: payload.request_id,
      });

      if (cibaTimeoutRef.current) clearTimeout(cibaTimeoutRef.current);
      cibaTimeoutRef.current = setTimeout(() => {
        setCibaStatus((prev) => {
          if (prev === "pending") {
            toast.warning("CIBA step-up timed out. Please retry the action.");
            setPendingAction(null);
            return "timeout";
          }
          return prev;
        });
        setTimeout(() => setCibaStatus("idle"), 3000);
      }, 30_000);
      return;
    }

    if (res.status === 403) {
      const payload = await readJsonResponse<{ error?: string; message?: string }>(res);
      toast.error(`${payload.error || "CONSENT_REQUIRED"}: ${payload.message || "Reconnect the service."}`);
      await Promise.all([refetchAudit(), refetchServices(), refetchHealth()]);
      return;
    }

    if (res.ok) {
      await Promise.all([refetchAudit(), refetchServices(), refetchHealth()]);
      return;
    }

    const errorText = await res.text().catch(() => "Unknown error");
    toast.error(`Action failed: ${errorText}`);
  }, [apiFetchWithUser, refetchAudit, refetchHealth, refetchServices]);

  const approveCIBA = useCallback(async () => {
    if (!pendingAction) return;
    if (cibaTimeoutRef.current) clearTimeout(cibaTimeoutRef.current);

    setCibaStatus("approved");
    await apiFetchWithUser("agent/ciba-resolve", {
      method: "POST",
      body: JSON.stringify({
        service: pendingAction.service,
        action: pendingAction.action,
        approved: true,
        requestId: pendingAction.requestId,
      }),
    });

    setTimeout(async () => {
      setCibaStatus("idle");
      setPendingAction(null);
      await Promise.all([refetchAudit(), refetchServices(), refetchHealth()]);
    }, 2000);
  }, [apiFetchWithUser, pendingAction, refetchAudit, refetchHealth, refetchServices]);

  const denyCIBA = useCallback(async () => {
    if (!pendingAction) return;
    if (cibaTimeoutRef.current) clearTimeout(cibaTimeoutRef.current);

    setCibaStatus("denied");
    await apiFetchWithUser("agent/ciba-resolve", {
      method: "POST",
      body: JSON.stringify({
        service: pendingAction.service,
        action: pendingAction.action,
        approved: false,
        requestId: pendingAction.requestId,
      }),
    });

    setTimeout(async () => {
      setCibaStatus("idle");
      setPendingAction(null);
      await Promise.all([refetchAudit(), refetchServices(), refetchHealth()]);
    }, 2000);
  }, [apiFetchWithUser, pendingAction, refetchAudit, refetchHealth, refetchServices]);

  const toggleSensitiveAction = useCallback(async (service: string, action: string) => {
    const current = sensitiveActions[service] || [];
    const hasAction = current.includes(action);
    const nextActions = hasAction ? current.filter((item) => item !== action) : [...current, action];

    setSensitiveActions((prev) => ({ ...prev, [service]: nextActions }));
    setServices((prev) =>
      prev.map((entry) => (entry.id === service ? { ...entry, sensitiveActions: nextActions } : entry)),
    );

    const res = await apiFetchWithUser("config/sensitive-actions", {
      method: "PUT",
      body: JSON.stringify({ service, sensitive_actions: nextActions }),
    });

    if (!res.ok) {
      await Promise.all([refetchServices(), refetchSensitiveActions()]);
    }

    await refetchAudit();
  }, [apiFetchWithUser, refetchAudit, refetchSensitiveActions, refetchServices, sensitiveActions]);

  const resetDemo = useCallback(async () => {
    if (cibaTimeoutRef.current) clearTimeout(cibaTimeoutRef.current);
    setResetModeEnabled(true);

    const res = await apiFetchWithUser("services/reset", { method: "POST" });
    if (res.ok) {
      autoConnectAttemptedRef.current = true;
      setOptimisticAuditLog([]);
      setAuditLog([]);
      setServiceOverrides({});
      setSensitiveActions({ ...defaultSensitiveActions });
      setServices((prev) => prev.map((service) => ({
        ...service,
        status: "disconnected",
        healthStatus: "revoked",
        grantedScopes: [],
        connectedAt: null,
        lastUsed: null,
        lastRefreshed: null,
        sensitiveActions: defaultSensitiveActions[service.id] || [],
      })));
      setVaultHealth({
        vault: "disconnected",
        mode: "fallback",
        connectedServices: 0,
        checkedAt: new Date(),
      });
      setCibaStatus("idle");
      setPendingAction(null);
      toast.success("Demo reset. All services disconnected and audit log cleared.");

      // Clear the reset-mode flag so subsequent fetches work normally
      setResetModeEnabled(false);

      await Promise.all([refetchServices(), refetchAudit(), refetchSensitiveActions(), refetchHealth()]);
      return;
    }

    setResetModeEnabled(false);
    toast.error("Failed to reset demo.");
  }, [apiFetchWithUser, refetchAudit, refetchHealth, refetchSensitiveActions, refetchServices]);

  return {
    services,
    auditLog,
    sensitiveActions,
    vaultHealth,
    cibaStatus,
    pendingAction,
    loading,
    connectService,
    revokeService,
    executeAction,
    approveCIBA,
    denyCIBA,
    toggleSensitiveAction,
    resetDemo,
    refetchAudit,
    refetchServices,
    refetchSensitiveActions,
    refetchHealth,
  };
}
