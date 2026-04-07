import { createAuditId, hashPayload } from "./utils.js";
import { supabaseAdmin } from "./db.js";

function isLegacyAuditSchemaError(error) {
  if (!error || typeof error !== "object") return false;

  const message = typeof error.message === "string" ? error.message : "";
  return (
    error.code === "PGRST204" &&
    (message.includes("params_hash") || message.includes("result_payload"))
  );
}

export async function writeAudit({
  service,
  action,
  userId,
  result,
  stepUp = false,
  details = null,
  params = null,
  resultPayload = null,
}) {
  const payload = {
    id: createAuditId(),
    service,
    action,
    user_id: userId,
    result,
    step_up: stepUp,
    token_hash: `0x${hashPayload({ service, action, timestamp: Date.now() }).slice(0, 8)}`,
    details,
    params_hash: hashPayload(params),
    result_payload: resultPayload,
  };

  const { error } = await supabaseAdmin.from("audit_log").insert(payload);
  if (!error) {
    return payload;
  }

  if (!isLegacyAuditSchemaError(error)) {
    throw error;
  }

  const legacyPayload = {
    id: payload.id,
    service: payload.service,
    action: payload.action,
    user_id: payload.user_id,
    result: payload.result,
    step_up: payload.step_up,
    token_hash: payload.token_hash,
    details: payload.details,
  };

  const { error: legacyError } = await supabaseAdmin.from("audit_log").insert(legacyPayload);
  if (legacyError) {
    throw legacyError;
  }

  return legacyPayload;
}

export async function listAudit({ limit = 50, service } = {}) {
  let query = supabaseAdmin
    .from("audit_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (service) {
    query = query.eq("service", service);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function clearAuditLog() {
  const { error, count } = await supabaseAdmin
    .from("audit_log")
    .delete({ count: "exact" })
    .neq("id", "");

  if (error) {
    // If delete fails due to missing RLS policy, log a warning but don't crash
    console.warn("clearAuditLog: delete failed, possibly missing RLS DELETE policy:", error.message);
    console.warn("Run this SQL in your Supabase Dashboard SQL Editor:");
    console.warn("  CREATE POLICY \"Anyone can delete audit log\" ON public.audit_log FOR DELETE USING (true);");
    return;
  }

  if (count === 0) {
    console.log("clearAuditLog: no rows to delete (already empty).");
  } else {
    console.log(`clearAuditLog: deleted ${count} rows.`);
  }
}

export function toAuditCsv(rows) {
  const header = [
    "timestamp",
    "service",
    "action",
    "params_hash",
    "result",
    "step_up_required",
    "step_up_outcome",
    "user_id",
  ];

  const lines = rows.map((row) => [
    row.created_at,
    row.service,
    row.action,
    row.params_hash || "",
    row.result,
    row.step_up ? "true" : "false",
    row.step_up ? row.result : "",
    row.user_id,
  ]);

  return [header, ...lines]
    .map((line) => line.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
}
