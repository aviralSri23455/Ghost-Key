import { Router } from "express";
import { getUserConnections, getUserContext, getVaultConnectivity } from "../auth0.js";
import { clearAuditLog, writeAudit } from "../audit.js";
import {
  getServiceState,
  getServicesState,
  mapServiceForApi,
  updateServiceState,
} from "../services.js";
import { getServiceConfig, isServiceId, serviceIds, sensitiveActionDefaults } from "../service-registry.js";
import { clearLiveConnectionSuppression, isResetModeRequest, suppressLiveConnectionsForUser } from "../demo-state.js";
import { jsonError } from "../utils.js";
import { revokeUpstreamToken } from "../vault.js";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const user = getUserContext(req);
    const vaultConnected = await getVaultConnectivity();
    const allowLiveConnections = !isResetModeRequest(req, user.userId);
    const userConnections = allowLiveConnections ? await getUserConnections(user) : new Set();
    const rows = await getServicesState();
    const now = new Date().toISOString();

    const liveRows = await Promise.all(rows.map(async (row) => {
      const serviceConfig = getServiceConfig(row.id);
      const liveConnected =
        row.status === "connected" || userConnections.has(serviceConfig.connection);

      if (!liveConnected) {
        return {
          ...row,
          status: "disconnected",
          granted_scopes: [],
          connected_at: null,
        };
      }

      const derivedRow = {
        ...row,
        status: "connected",
        granted_scopes:
          Array.isArray(row.granted_scopes) && row.granted_scopes.length > 0
            ? row.granted_scopes
            : serviceConfig.scopes,
        connected_at: row.connected_at || now,
      };

      if (
        row.status !== "connected" ||
        !Array.isArray(row.granted_scopes) ||
        row.granted_scopes.length === 0 ||
        !row.connected_at
      ) {
        await updateServiceState(row.id, {
          status: "connected",
          granted_scopes: derivedRow.granted_scopes,
          connected_at: derivedRow.connected_at,
        });
      }

      return derivedRow;
    }));

    res.json(liveRows.map((row) => mapServiceForApi(row, { vaultConnected })));
  } catch (error) {
    next(error);
  }
});

router.delete("/:service", async (req, res, next) => {
  try {
    const { service } = req.params;
    if (!isServiceId(service)) {
      return jsonError(res, 404, "UNKNOWN_SERVICE", "Unknown service.");
    }

    const user = getUserContext(req);
    clearLiveConnectionSuppression(user.userId);
    const serviceState = await getServiceState(service);
    const serviceConfig = getServiceConfig(service);

    let upstreamRevoked = true;
    try {
      await revokeUpstreamToken({
        service,
        userAccessToken: user.accessToken,
        userEmail: user.email,
        connection: serviceConfig.connection,
        scopes: serviceConfig.scopes,
        loginHint: user.email || undefined,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("Token Vault authorization required")) {
        upstreamRevoked = false;
      } else {
        throw error;
      }
    }

    await updateServiceState(service, {
      status: "disconnected",
      granted_scopes: [],
      connected_at: null,
      last_used: null,
    });

    await writeAudit({
      service,
      action: "revoke_token",
      userId: user.userId,
      result: "revoked",
      details: upstreamRevoked
        ? `Upstream ${service} token revoked and service disconnected.`
        : `Service disconnected locally. Upstream ${service} token revoke was skipped because Token Vault access was unavailable.`,
      resultPayload: {
        previous_status: serviceState.status,
        upstream_revoked: upstreamRevoked,
      },
    });

    res.json({
      status: "revoked",
      service,
      upstream_revoked: upstreamRevoked,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/reset", async (req, res, next) => {
  try {
    const user = getUserContext(req);
    suppressLiveConnectionsForUser(user.userId);

    // Try resetting with sensitive_actions first; if the column doesn't exist, retry without it
    const results = await Promise.allSettled(
      serviceIds.map((serviceId) =>
        updateServiceState(serviceId, {
          status: "disconnected",
          granted_scopes: [],
          connected_at: null,
          last_used: null,
          sensitive_actions: sensitiveActionDefaults[serviceId] || [],
        }),
      ),
    );

    const hasColumnError = results.some(
      (r) => r.status === "rejected" && r.reason?.code === "PGRST204",
    );

    if (hasColumnError) {
      // Retry without sensitive_actions for databases missing that column
      await Promise.all(
        serviceIds.map((serviceId) =>
          updateServiceState(serviceId, {
            status: "disconnected",
            granted_scopes: [],
            connected_at: null,
            last_used: null,
          }),
        ),
      );
    }

    await clearAuditLog();

    // Clear the suppression flag after reset is complete
    clearLiveConnectionSuppression(user.userId);

    res.json({ status: "reset" });
  } catch (error) {
    next(error);
  }
});

export default router;
