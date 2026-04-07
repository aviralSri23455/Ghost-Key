import { supabaseAdmin } from "./db.js";

function isMissingConsentDelegationsTable(error) {
  if (!error || typeof error !== "object") return false;
  return error.code === "PGRST205" && typeof error.message === "string" && error.message.includes("consent_delegations");
}

export async function upsertDelegation({ grantedBy, grantedTo, service, scopes }) {
  const payload = {
    granted_by: grantedBy,
    granted_to: grantedTo,
    service,
    scopes,
    active: true,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("consent_delegations")
    .upsert(payload, { onConflict: "granted_by,granted_to,service" })
    .select("*")
    .single();

  if (error) {
    if (isMissingConsentDelegationsTable(error)) {
      return {
        ...payload,
        id: null,
        created_at: new Date().toISOString(),
      };
    }
    throw error;
  }
  return data;
}

export async function listDelegations(grantedBy) {
  const { data, error } = await supabaseAdmin
    .from("consent_delegations")
    .select("*")
    .eq("granted_by", grantedBy)
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingConsentDelegationsTable(error)) {
      return [];
    }
    throw error;
  }
  return data;
}

export async function getDelegationForService(grantedBy, service) {
  const { data, error } = await supabaseAdmin
    .from("consent_delegations")
    .select("*")
    .eq("granted_by", grantedBy)
    .eq("service", service)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingConsentDelegationsTable(error)) {
      return null;
    }
    throw error;
  }
  return data;
}
