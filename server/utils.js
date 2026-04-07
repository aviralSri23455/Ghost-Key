import crypto from "node:crypto";

export function hashPayload(value) {
  return crypto.createHash("sha256").update(JSON.stringify(value || {})).digest("hex");
}

export function createAuditId() {
  return `audit-${crypto.randomUUID()}`;
}

export function normalizeStringArray(value, fallback = []) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string")
    : [...fallback];
}

export function getToolContext(service, action) {
  return {
    threadID: `ghostkey-${service}`,
    toolCallID: crypto.randomUUID(),
    toolName: action,
  };
}

export function jsonError(res, status, error, message, extra = {}) {
  return res.status(status).json({
    error,
    message,
    ...extra,
  });
}
