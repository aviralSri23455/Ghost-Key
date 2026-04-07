const resetSuppressedUsers = new Set();

export function isResetModeRequest(req, userId) {
  const headerValue = req?.headers?.["x-ghostkey-reset-mode"];
  const headerSuppressed =
    headerValue === "true" ||
    (Array.isArray(headerValue) && headerValue.includes("true"));

  return headerSuppressed || isLiveConnectionSuppressed(userId);
}

export function suppressLiveConnectionsForUser(userId) {
  if (typeof userId === "string" && userId.trim()) {
    resetSuppressedUsers.add(userId.trim());
  }
}

export function clearLiveConnectionSuppression(userId) {
  if (typeof userId === "string" && userId.trim()) {
    resetSuppressedUsers.delete(userId.trim());
  }
}

export function isLiveConnectionSuppressed(userId) {
  return typeof userId === "string" && userId.trim()
    ? resetSuppressedUsers.has(userId.trim())
    : false;
}
