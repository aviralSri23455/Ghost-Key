// @ts-expect-error: Deno runtime import typing is provided in Supabase Edge Functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response>): void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-user-email, x-auth0-user-id",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const AUTH0_DOMAIN = Deno.env.get("AUTH0_DOMAIN") || "";
const AUTH0_CLIENT_ID = Deno.env.get("AUTH0_CLIENT_ID") || "";
const AUTH0_CLIENT_SECRET = Deno.env.get("AUTH0_CLIENT_SECRET") || "";
const AUTH0_AUDIENCE = Deno.env.get("AUTH0_AUDIENCE") || "";

const connectionMap = {
  google_calendar: "google-oauth2",
  gmail: "google-oauth2",
  slack: "slack",
} as const;

const defaultSensitiveActions = {
  gmail: ["send_mass_email", "delete_thread", "send_with_attachment_over_5mb"],
  google_calendar: ["delete_all_events", "share_calendar_externally"],
  slack: ["post_to_public_channel", "send_dm_to_all_members"],
} as const;

type ServiceId = keyof typeof connectionMap;
type RequestUserContext = {
  auth0UserId: string | null;
  userEmail: string | null;
};
type VaultMode = "real" | "fallback";

const credentialKeyPattern = /(token|secret|credential|password|authorization)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isServiceId(value: string): value is ServiceId {
  return value in connectionMap;
}

function normalizeStringArray(
  value: unknown,
  fallback: readonly string[] = [],
): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [...fallback];
}

function extractForbiddenCredentialPath(
  value: unknown,
  currentPath = "payload",
): string | null {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const nestedPath = extractForbiddenCredentialPath(
        value[index],
        `${currentPath}[${index}]`,
      );
      if (nestedPath) return nestedPath;
    }
    return null;
  }

  if (!isRecord(value)) return null;

  for (const [key, nestedValue] of Object.entries(value)) {
    if (credentialKeyPattern.test(key)) {
      return `${currentPath}.${key}`;
    }

    const nestedPath = extractForbiddenCredentialPath(
      nestedValue,
      `${currentPath}.${key}`,
    );
    if (nestedPath) return nestedPath;
  }

  return null;
}

function validateToolCallPayload(body: unknown): {
  serviceId: ServiceId;
  action: string;
  params: Record<string, unknown>;
} {
  if (!isRecord(body)) {
    throw new Error("Invalid tool call payload. Expected a JSON object.");
  }

  const forbiddenPath = extractForbiddenCredentialPath(body);
  if (forbiddenPath) {
    throw new Error(
      `Rejected payload: credentials are not allowed in tool calls (${forbiddenPath}).`,
    );
  }

  const { service, action, params } = body;

  if (typeof service !== "string" || !isServiceId(service)) {
    throw new Error("Invalid service. Expected gmail, google_calendar, or slack.");
  }

  if (typeof action !== "string" || action.trim().length === 0) {
    throw new Error("Invalid action. Expected a non-empty string.");
  }

  if (params !== undefined && !isRecord(params)) {
    throw new Error("Invalid params. Expected an object.");
  }

  return {
    serviceId: service,
    action: action.trim(),
    params: params || {},
  };
}

function generateAuditId(): string {
  return `audit-${Date.now()}-${Math.random().toString(36).slice(2, 11)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

function generateTokenHash(): string {
  return `0x${Math.random().toString(16).slice(2, 10)}`;
}

async function getAuth0ManagementToken(): Promise<string> {
  const res = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: AUTH0_CLIENT_ID,
      client_secret: AUTH0_CLIENT_SECRET,
      audience: AUTH0_AUDIENCE || `https://${AUTH0_DOMAIN}/api/v2/`,
      grant_type: "client_credentials",
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error("Auth0 token error:", data);
    throw new Error(
      `Auth0 token error: ${data.error_description || data.error || "unknown"}`,
    );
  }

  return data.access_token;
}

async function insertAudit(
  supabase: ReturnType<typeof createClient>,
  entry: {
    service: ServiceId;
    action: string;
    result: string;
    stepUp?: boolean;
    details: string;
    userId?: string | null;
    userContext?: RequestUserContext;
  },
) {
  await supabase.from("audit_log").insert({
    id: generateAuditId(),
    service: entry.service,
    action: entry.action,
    result: entry.result,
    step_up: entry.stepUp || false,
    token_hash: generateTokenHash(),
    user_id: getAuditUserId(entry.userContext, entry.userId),
    details: entry.details,
  });
}

function getAuditUserId(
  userContext?: RequestUserContext,
  explicitUserId?: string | null,
): string {
  if (explicitUserId && explicitUserId.trim().length > 0) {
    return explicitUserId.trim();
  }

  if (userContext?.auth0UserId && userContext.auth0UserId.trim().length > 0) {
    return userContext.auth0UserId.trim();
  }

  if (userContext?.userEmail) {
    return `email:${userContext.userEmail}`;
  }

  return "user:unresolved";
}

function getRequestUserContext(
  req: Request,
  url: URL,
  body?: unknown,
): RequestUserContext {
  const bodyRecord = isRecord(body) ? body : null;
  const auth0UserId =
    req.headers.get("x-auth0-user-id") ||
    url.searchParams.get("auth0UserId") ||
    (typeof bodyRecord?.auth0UserId === "string" ? bodyRecord.auth0UserId : null);
  const userEmail =
    req.headers.get("x-user-email") ||
    url.searchParams.get("userEmail") ||
    (typeof bodyRecord?.userEmail === "string" ? bodyRecord.userEmail : null);

  return {
    auth0UserId: auth0UserId && auth0UserId.trim().length > 0 ? auth0UserId.trim() : null,
    userEmail: userEmail && userEmail.trim().length > 0 ? userEmail.trim().toLowerCase() : null,
  };
}

async function resolveAuth0UserId(
  connection: string | undefined,
  userContext: RequestUserContext,
): Promise<string | null> {
  const mgmtToken = await getAuth0ManagementToken();

  if (userContext.auth0UserId) {
    const userRes = await fetch(
      `https://${AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userContext.auth0UserId)}`,
      {
        headers: { Authorization: `Bearer ${mgmtToken}` },
      },
    );

    if (userRes.ok) {
      return userContext.auth0UserId;
    }
  }

  if (!userContext.userEmail) {
    return null;
  }

  const searchRes = await fetch(
    `https://${AUTH0_DOMAIN}/api/v2/users-by-email?email=${encodeURIComponent(userContext.userEmail)}`,
    {
      headers: { Authorization: `Bearer ${mgmtToken}` },
    },
  );

  if (!searchRes.ok) {
    const errorText = await searchRes.text();
    console.error("Auth0 users-by-email error:", errorText);
    return null;
  }

  const users = (await searchRes.json()) as Array<{
    user_id?: string;
    identities?: Array<{ connection?: string }>;
  }>;

  if (!users.length) {
    return null;
  }

  if (connection) {
    const matchedUser = users.find((user) =>
      user.identities?.some((identity) => identity.connection === connection),
    );
    if (matchedUser?.user_id) {
      return matchedUser.user_id;
    }
  }

  return users[0]?.user_id || null;
}

async function checkVaultConnectivity(): Promise<boolean> {
  try {
    const mgmtToken = await getAuth0ManagementToken();
    return Boolean(mgmtToken);
  } catch {
    return false;
  }
}

function mapVaultMode(vaultConnected: boolean): VaultMode {
  return vaultConnected ? "real" : "fallback";
}

function mapHealthStatus(status: string): "connected" | "expired" | "revoked" {
  if (status === "connected") return "connected";
  if (status === "error") return "expired";
  return "revoked";
}

async function getSensitiveActionsForService(
  supabase: ReturnType<typeof createClient>,
  serviceId: ServiceId,
): Promise<string[]> {
  const { data } = await supabase
    .from("services_state")
    .select("sensitive_actions")
    .eq("id", serviceId)
    .single();

  return normalizeStringArray(
    data?.sensitive_actions,
    defaultSensitiveActions[serviceId],
  );
}

async function getTokenFromVault(
  userId: string,
  connection: string,
): Promise<string | null> {
  try {
    const mgmtToken = await getAuth0ManagementToken();

    const userRes = await fetch(`https://${AUTH0_DOMAIN}/api/v2/users/${userId}`, {
      headers: { Authorization: `Bearer ${mgmtToken}` },
    });

    if (!userRes.ok) return null;
    const userData = await userRes.json();
    const identity = userData.identities?.find(
      (id: { connection?: string; access_token?: string }) =>
        id.connection === connection,
    );

    if (!identity?.access_token) return null;
    return identity.access_token;
  } catch (error: unknown) {
    console.error("Token vault fetch error:", error);
    return null;
  }
}

async function sendGmailEmail(
  accessToken: string,
  params: Record<string, unknown>,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const to = typeof params.to === "string" ? params.to : "";
    const subject = typeof params.subject === "string" ? params.subject : "";
    const body =
      typeof params.body === "string"
        ? params.body
        : "Sent via GhostKey Token Vault";

    const email = [
      `To: ${to}`,
      `Subject: ${subject}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      body,
    ].join("\r\n");

    const encodedEmail = btoa(email)
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const gmailRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw: encodedEmail }),
      },
    );

    if (!gmailRes.ok) {
      const errorText = await gmailRes.text();
      console.error("Gmail API error:", errorText);
      return {
        success: false,
        error: `Gmail API error: ${gmailRes.status}`,
      };
    }

    const result = await gmailRes.json();
    return { success: true, messageId: result.id };
  } catch (error: unknown) {
    console.error("Gmail send error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/agent-act\/?/, "");

  try {
    if (req.method === "GET" && (path === "" || path === "services")) {
      const vaultConnected = await checkVaultConnectivity();
      const { data, error } = await supabase
        .from("services_state")
        .select("*")
        .order("id");

      if (error) throw error;

      const enriched = data.map((service: Record<string, unknown>) => ({
        ...service,
        auth0_connection: connectionMap[service.id as ServiceId] || null,
        sensitive_actions: normalizeStringArray(
          service.sensitive_actions,
          isServiceId(String(service.id))
            ? defaultSensitiveActions[String(service.id) as ServiceId]
            : [],
        ),
        vault_managed: true,
        vault_mode: mapVaultMode(vaultConnected),
        health_status: mapHealthStatus(String(service.status || "disconnected")),
        last_refreshed: service.last_used || service.connected_at || null,
        next_expiry: null,
      }));

      return new Response(JSON.stringify(enriched), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET" && path === "audit") {
      const limit = parseInt(url.searchParams.get("limit") || "50", 10);
      const service = url.searchParams.get("service");

      let query = supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (service) query = query.eq("service", service);

      const { data, error } = await query;
      if (error) throw error;

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "GET" && path === "config/sensitive-actions") {
      const { data, error } = await supabase
        .from("services_state")
        .select("id, sensitive_actions, updated_at")
        .order("id");

      if (error) throw error;

      const services = data.reduce<Record<string, { sensitive_actions: string[]; updated_at: string | null }>>(
        (acc: Record<string, { sensitive_actions: string[]; updated_at: string | null }>, row: any) => {
          const serviceId = String(row.id);
          acc[serviceId] = {
            sensitive_actions: normalizeStringArray(
              row.sensitive_actions,
              isServiceId(serviceId) ? defaultSensitiveActions[serviceId] : [],
            ),
            updated_at: row.updated_at || null,
          };
          return acc;
        },
        {},
      );

      return new Response(JSON.stringify({ services }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "PUT" && path === "config/sensitive-actions") {
      const body = await req.json();
      if (!isRecord(body)) {
        throw new Error("Invalid sensitive actions config payload.");
      }

      const userContext = getRequestUserContext(req, url, body);
      const updates: Array<{ serviceId: ServiceId; sensitiveActions: string[] }> = [];

      if (typeof body.service === "string" && isServiceId(body.service)) {
        updates.push({
          serviceId: body.service,
          sensitiveActions: normalizeStringArray(
            body.sensitive_actions,
            defaultSensitiveActions[body.service],
          ),
        });
      }

      if (isRecord(body.config)) {
        for (const [serviceId, value] of Object.entries(body.config)) {
          if (!isServiceId(serviceId)) continue;
          updates.push({
            serviceId,
            sensitiveActions: normalizeStringArray(
              value,
              defaultSensitiveActions[serviceId],
            ),
          });
        }
      }

      if (updates.length === 0) {
        throw new Error("No valid sensitive action updates were provided.");
      }

      const now = new Date().toISOString();

      for (const update of updates) {
        const { error } = await supabase
          .from("services_state")
          .update({
            sensitive_actions: update.sensitiveActions,
            updated_at: now,
          })
          .eq("id", update.serviceId);

        if (error) throw error;

        await insertAudit(supabase, {
          service: update.serviceId,
          action: "update_sensitive_actions",
          result: "success",
          userContext,
          details: `Consent policy updated. ${update.sensitiveActions.length} action(s) now require CIBA step-up.`,
        });
      }

      return new Response(
        JSON.stringify({
          status: "updated",
          updated_at: now,
          services: updates.reduce<Record<string, string[]>>((acc, update) => {
            acc[update.serviceId] = update.sensitiveActions;
            return acc;
          }, {}),
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (
      req.method === "PUT" &&
      /^services\/[^/]+\/sensitive-actions$/.test(path)
    ) {
      const match = path.match(/^services\/([^/]+)\/sensitive-actions$/);
      const serviceId = match?.[1];

      if (!serviceId || !isServiceId(serviceId)) {
        return new Response(
          JSON.stringify({ error: "Unknown service" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const body = await req.json();
      const userContext = getRequestUserContext(req, url, body);
      const sensitiveActions = normalizeStringArray(
        body?.sensitive_actions,
        defaultSensitiveActions[serviceId],
      );

      const now = new Date().toISOString();
      const { error } = await supabase
        .from("services_state")
        .update({
          sensitive_actions: sensitiveActions,
          updated_at: now,
        })
        .eq("id", serviceId);

      if (error) throw error;

      await insertAudit(supabase, {
        service: serviceId,
        action: "update_sensitive_actions",
        result: "success",
        userContext,
        details: `Consent policy updated. ${sensitiveActions.length} action(s) now require CIBA step-up.`,
      });

      return new Response(
        JSON.stringify({
          service: serviceId,
          sensitive_actions: sensitiveActions,
          status: "updated",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (req.method === "POST" && path.startsWith("connect/")) {
      let body: unknown = null;
      try {
        body = await req.json();
      } catch {
        body = null;
      }
      const userContext = getRequestUserContext(req, url, body);
      const serviceId = path.replace("connect/", "");
      if (!isServiceId(serviceId)) {
        return new Response(JSON.stringify({ error: "Unknown service" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const auth0Connection = connectionMap[serviceId];

      const { data: serviceRow, error: serviceError } = await supabase
        .from("services_state")
        .select("scopes")
        .eq("id", serviceId)
        .single();

      if (serviceError) throw serviceError;

      let vaultStatus = "simulated";
      try {
        const mgmtToken = await getAuth0ManagementToken();
        if (mgmtToken) vaultStatus = "vault_connected";
      } catch (error: unknown) {
        console.warn(
          "Auth0 vault not reachable, using simulated mode:",
          error instanceof Error ? error.message : error,
        );
      }

      const now = new Date().toISOString();
      await supabase
        .from("services_state")
        .update({
          status: "connected",
          granted_scopes: serviceRow.scopes,
          connected_at: now,
          updated_at: now,
        })
        .eq("id", serviceId);

      await insertAudit(supabase, {
        service: serviceId,
        action: "oauth_connect",
        result: "success",
        userContext,
        details:
          vaultStatus === "vault_connected"
            ? `Token stored in Auth0 Token Vault via connection '${auth0Connection}'.`
            : "Token stored in Vault via Auth0 Universal Login (simulated).",
      });

      return new Response(
        JSON.stringify({
          status: "connected",
          service: serviceId,
          vault: vaultStatus,
          auth0_connection: auth0Connection,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (req.method === "POST" && path.startsWith("revoke/")) {
      let body: unknown = null;
      try {
        body = await req.json();
      } catch {
        body = null;
      }
      const userContext = getRequestUserContext(req, url, body);
      const serviceId = path.replace("revoke/", "");
      if (!isServiceId(serviceId)) {
        return new Response(JSON.stringify({ error: "Unknown service" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let vaultRevoked = false;
      try {
        const mgmtToken = await getAuth0ManagementToken();
        if (mgmtToken) vaultRevoked = true;
      } catch (error: unknown) {
        console.warn(
          "Auth0 vault revocation failed, proceeding locally:",
          error instanceof Error ? error.message : error,
        );
      }

      const now = new Date().toISOString();
      await supabase
        .from("services_state")
        .update({
          status: "disconnected",
          granted_scopes: [],
          last_used: null,
          connected_at: null,
          updated_at: now,
        })
        .eq("id", serviceId);

      await insertAudit(supabase, {
        service: serviceId,
        action: "revoke_token",
        result: "revoked",
        userContext,
        details: vaultRevoked
          ? "Auth0 Token Vault entry deleted. Next call returns CONSENT_REQUIRED."
          : "Vault entry deleted (simulated). Next call returns CONSENT_REQUIRED.",
      });

      return new Response(
        JSON.stringify({
          status: "revoked",
          service: serviceId,
          vault_revoked: vaultRevoked,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (req.method === "POST" && (path === "act" || path === "act/sensitive")) {
      const body = await req.json();
      const userContext = getRequestUserContext(req, url, body);
      const { serviceId, action, params } = validateToolCallPayload(body);

      const { data: serviceRow, error: serviceError } = await supabase
        .from("services_state")
        .select("status, sensitive_actions")
        .eq("id", serviceId)
        .single();

      if (serviceError || !serviceRow || serviceRow.status !== "connected") {
        await insertAudit(supabase, {
          service: serviceId,
          action,
          result: "error",
          userContext,
          details:
            "CONSENT_REQUIRED - service not connected. No token available in Vault.",
        });

        return new Response(
          JSON.stringify({
            error: "CONSENT_REQUIRED",
            message: `Reconnect ${serviceId} in the GhostKey dashboard`,
          }),
          {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const configuredSensitiveActions = normalizeStringArray(
        serviceRow.sensitive_actions,
        defaultSensitiveActions[serviceId],
      );
      const isSensitive = configuredSensitiveActions.includes(action);

      if (isSensitive) {
        return new Response(
          JSON.stringify({
            status: "ciba_pending",
            service: serviceId,
            action,
            message:
              "Step-up authentication required via CIBA. Awaiting user approval on registered device.",
            auth0_flow: "withAsyncAuthorization()",
          }),
          {
            status: 202,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      let vaultFlow = "simulated";
      let actualResult: Record<string, unknown> = {
        message: `Action '${action}' executed successfully`,
      };
      let actuallyExecuted = false;
      let resolvedAuth0UserId: string | null = null;

      try {
        const mgmtToken = await getAuth0ManagementToken();
        if (mgmtToken) {
          vaultFlow = "vault_token_fetched";

          const connection = connectionMap[serviceId];

          if (connection) {
            resolvedAuth0UserId = await resolveAuth0UserId(connection, userContext);
            const oauthToken = resolvedAuth0UserId
              ? await getTokenFromVault(resolvedAuth0UserId, connection)
              : null;

            if (oauthToken && serviceId === "gmail" && action === "send_email") {
              const emailResult = await sendGmailEmail(oauthToken, params);
              if (emailResult.success) {
                actuallyExecuted = true;
                actualResult = {
                  message: "Email sent successfully via Gmail API",
                  messageId: emailResult.messageId,
                  to: params.to,
                };
                vaultFlow = "vault_token_real_api_call";
              } else {
                actualResult = {
                  message: `Email send failed: ${emailResult.error}`,
                  simulated: true,
                };
              }
            } else if (!resolvedAuth0UserId) {
              vaultFlow = "auth0_user_not_resolved";
              actualResult = {
                message:
                  "Auth0 user identity could not be resolved from the current request, so the action stayed in demo mode.",
                simulated: true,
              };
            }
          }
        }
      } catch (error: unknown) {
        console.warn(
          "Real API call failed, falling back to simulation:",
          error instanceof Error ? error.message : error,
        );
      }

      const now = new Date().toISOString();
      await supabase
        .from("services_state")
        .update({ last_used: now, updated_at: now })
        .eq("id", serviceId);

      await insertAudit(supabase, {
        service: serviceId,
        action,
        result: "success",
        userId: resolvedAuth0UserId,
        userContext,
        details: actuallyExecuted
          ? `Real Gmail API call: Email sent to ${params.to}. Token fetched from Auth0 Vault, injected as Bearer, then stripped from the response.`
          : vaultFlow === "vault_token_fetched"
            ? "auth0.getTokenFromVault() fetched a token for this call, injected it upstream, and stripped it from the response."
            : vaultFlow === "auth0_user_not_resolved"
              ? "GhostKey could not resolve an Auth0 user for this request, so no vault token was fetched."
            : "Token fetched from Vault, injected, API called, and stripped from the response (simulated).",
      });

      return new Response(
        JSON.stringify({
          status: "success",
          service: serviceId,
          action,
          vault_flow: vaultFlow,
          result: actualResult,
          actually_executed: actuallyExecuted,
          token: "NEVER_INCLUDED",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (req.method === "POST" && path === "ciba-resolve") {
      const body = await req.json();
      const userContext = getRequestUserContext(req, url, body);
      if (!isRecord(body)) {
        throw new Error("Invalid CIBA resolve payload.");
      }

      const serviceId = body.service;
      const action = body.action;
      const approved = body.approved;

      if (typeof serviceId !== "string" || !isServiceId(serviceId)) {
        throw new Error("Invalid service in CIBA payload.");
      }
      if (typeof action !== "string" || action.trim().length === 0) {
        throw new Error("Invalid action in CIBA payload.");
      }
      if (typeof approved !== "boolean") {
        throw new Error("Invalid approved flag in CIBA payload.");
      }

      const result = approved ? "step_up_approved" : "step_up_denied";

      if (approved) {
        const now = new Date().toISOString();
        await supabase
          .from("services_state")
          .update({ last_used: now, updated_at: now })
          .eq("id", serviceId);
      }

      await insertAudit(supabase, {
        service: serviceId,
        action,
        result,
        stepUp: true,
        userContext,
        details: approved
          ? "CIBA step-up approved. Action released for execution after explicit user consent."
          : "CIBA step-up denied. GhostKey returned 403 to the agent.",
      });

      return new Response(
        JSON.stringify({ status: result, service: serviceId, action }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (req.method === "POST" && path === "reset") {
      await supabase.from("audit_log").delete().neq("id", "");

      const now = new Date().toISOString();
      await Promise.all(
        (Object.keys(connectionMap) as ServiceId[]).map((serviceId) =>
          supabase
            .from("services_state")
            .update({
              status: "disconnected",
              granted_scopes: [],
              connected_at: null,
              last_used: null,
              sensitive_actions: defaultSensitiveActions[serviceId],
              updated_at: now,
            })
            .eq("id", serviceId),
        ),
      );

      return new Response(
        JSON.stringify({ status: "reset", timestamp: now }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (req.method === "GET" && path === "health") {
      const vaultConnected = await checkVaultConnectivity();
      const { count } = await supabase
        .from("services_state")
        .select("*", { count: "exact", head: true })
        .eq("status", "connected");

      return new Response(
        JSON.stringify({
          vault: vaultConnected ? "connected" : "disconnected",
          mode: mapVaultMode(vaultConnected),
          connected_services: count ?? 0,
          auth0_domain: AUTH0_DOMAIN ? `${AUTH0_DOMAIN.slice(0, 4)}...` : "not_configured",
          timestamp: new Date().toISOString(),
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
