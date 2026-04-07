import { Router } from "express";
import { getUserConnections, getUserContext, getVaultConnectivity } from "../auth0.js";
import { writeAudit } from "../audit.js";
import { isResetModeRequest } from "../demo-state.js";
import { executeServiceAction, getSensitiveActions, validateToolCallPayload } from "../bridge.js";
import { getServiceConfig } from "../service-registry.js";
import { getServiceState, getServicesState, updateServiceState } from "../services.js";
import { requestStepUp, resolveBrowserFallbackStepUp } from "../step-up.js";
import { jsonError } from "../utils.js";

const router = Router();

async function handleAct(req, res) {
  const user = getUserContext(req);
  const { service, action, params } = validateToolCallPayload(req.body);
  const serviceState = await getServiceState(service);
  const serviceConfig = getServiceConfig(service);
  const userConnections = isResetModeRequest(req, user.userId) ? new Set() : await getUserConnections(user);
  const serviceConnected =
    serviceState.status === "connected" || userConnections.has(serviceConfig.connection);

  if (!serviceConnected) {
    await writeAudit({
      service,
      action,
      userId: user.userId,
      result: "error",
      params,
      details: "CONSENT_REQUIRED - service is not connected.",
    });
    return jsonError(res, 403, "CONSENT_REQUIRED", `Reconnect ${service} in the GhostKey dashboard.`);
  }

  if (serviceState.status !== "connected") {
    await updateServiceState(service, {
      status: "connected",
      granted_scopes: serviceConfig.scopes,
      connected_at: serviceState.connected_at || new Date().toISOString(),
    });
  }

  const sensitiveActions = getSensitiveActions(serviceState);
  const isSensitive = req.body.forceSensitive || sensitiveActions.includes(action);

  if (isSensitive) {
    const stepUp = await requestStepUp({
      ownerUserId: user.userId,
      ownerEmail: user.email,
      service,
      action,
    });

    if (stepUp.mode === "browser") {
      return res.status(202).json({
        status: "ciba_pending",
        service,
        action,
        request_id: stepUp.requestId,
        message: "Browser fallback approval is waiting in the GhostKey modal.",
      });
    }

    if (!stepUp.approved) {
      await writeAudit({
        service,
        action,
        userId: user.userId,
        result: "step_up_denied",
        stepUp: true,
        params,
        details: stepUp.message || "Step-up request was denied or unavailable.",
      });
      return jsonError(res, 403, stepUp.error || "STEP_UP_DENIED", stepUp.message || "Sensitive action denied.");
    }
  }

  let result;

  try {
    result = await executeServiceAction({
      service,
      action,
      params,
      userAccessToken: user.accessToken,
      userEmail: user.email,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Token Vault authorization required")) {
      await updateServiceState(service, {
        status: "disconnected",
        granted_scopes: [],
        connected_at: null,
        last_used: null,
      });

      await writeAudit({
        service,
        action,
        userId: user.userId,
        result: "error",
        params,
        details: "CONSENT_REQUIRED - live Token Vault access is no longer available for this service.",
      });

      return jsonError(res, 403, "CONSENT_REQUIRED", `Reconnect ${service} in the GhostKey dashboard.`);
    }

    throw error;
  }

  await updateServiceState(service, {
    last_used: new Date().toISOString(),
  });

  await writeAudit({
    service,
    action,
    userId: user.userId,
    result: "success",
    stepUp: isSensitive,
    params,
    details: "Action executed through the GhostKey Node bridge with Auth0 Token Vault.",
    resultPayload: result,
  });

  return res.json({
    status: "success",
    service,
    action,
    result,
    token: "NEVER_INCLUDED",
  });
}

router.post("/act", async (req, res, next) => {
  try {
    await handleAct(req, res);
  } catch (error) {
    next(error);
  }
});

router.post("/act/sensitive", async (req, res, next) => {
  try {
    req.body = {
      ...req.body,
      forceSensitive: true,
    };
    await handleAct(req, res);
  } catch (error) {
    next(error);
  }
});

router.post("/ciba-resolve", async (req, res, next) => {
  try {
    const user = getUserContext(req);
    const { service, action, approved, requestId } = req.body;

    const resolved = resolveBrowserFallbackStepUp({
      requestId: typeof requestId === "string" ? requestId : undefined,
      userId: user.userId,
      service,
      action,
      approved: Boolean(approved),
    });

    if (!resolved) {
      return jsonError(res, 404, "STEP_UP_NOT_FOUND", "No pending browser fallback approval was found.");
    }

    await writeAudit({
      service,
      action,
      userId: user.userId,
      result: approved ? "step_up_approved" : "step_up_denied",
      stepUp: true,
      details: approved
        ? "Browser fallback step-up approved from dashboard modal."
        : "Browser fallback step-up denied from dashboard modal.",
    });

    return res.json({
      status: approved ? "step_up_approved" : "step_up_denied",
      service,
      action,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/health", async (req, res, next) => {
  try {
    const user = getUserContext(req);
    const connected = await getVaultConnectivity();
    const rows = await getServicesState();
    const userConnections = isResetModeRequest(req, user.userId) ? new Set() : await getUserConnections(user);
    const connectedServices = rows.map((row) => {
      const serviceConfig = getServiceConfig(row.id);
      return row.status === "connected" || userConnections.has(serviceConfig.connection);
    });

    res.json({
      vault: connected ? "connected" : "disconnected",
      mode: connected ? "real" : "fallback",
      connected_services: connectedServices.filter(Boolean).length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
