import { supabaseAdmin } from "./db.js";
import { getServiceConfig, sensitiveActionDefaults } from "./service-registry.js";
import { normalizeStringArray } from "./utils.js";

export async function getServicesState() {
  const { data, error } = await supabaseAdmin
    .from("services_state")
    .select("*")
    .order("id");

  if (error) throw error;
  return data;
}

export async function getServiceState(serviceId) {
  const { data, error } = await supabaseAdmin
    .from("services_state")
    .select("*")
    .eq("id", serviceId)
    .single();

  if (error) throw error;
  return data;
}

export async function updateServiceState(serviceId, patch) {
  const { data, error } = await supabaseAdmin
    .from("services_state")
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", serviceId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function getSensitiveActionsConfig() {
  const rows = await getServicesState();

  return rows.reduce((acc, row) => {
    acc[row.id] = normalizeStringArray(
      row.sensitive_actions,
      sensitiveActionDefaults[row.id] || [],
    );
    return acc;
  }, {});
}

export async function updateSensitiveActionsConfig(serviceId, actions) {
  return updateServiceState(serviceId, {
    sensitive_actions: actions,
  });
}

export function mapServiceForApi(row, { vaultConnected }) {
  const service = getServiceConfig(row.id);
  const healthStatus =
    row.status === "connected" ? "connected" : row.status === "error" ? "expired" : "revoked";

  return {
    ...row,
    auth0_connection: service.connection,
    vault_mode: vaultConnected ? "real" : "fallback",
    health_status: healthStatus,
    last_refreshed: row.last_used || row.connected_at || null,
    next_expiry: null,
  };
}
