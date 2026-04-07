import { Router } from "express";
import { getUserContext } from "../auth0.js";
import { getServiceConfig, isServiceId } from "../service-registry.js";
import { getServiceState, updateServiceState } from "../services.js";
import { writeAudit } from "../audit.js";
import { clearLiveConnectionSuppression } from "../demo-state.js";
import { jsonError } from "../utils.js";

const router = Router();

router.post("/connect/:service", async (req, res, next) => {
  try {
    const { service } = req.params;
    if (!isServiceId(service)) {
      return jsonError(res, 404, "UNKNOWN_SERVICE", "Unknown service.");
    }

    const user = getUserContext(req);
    clearLiveConnectionSuppression(user.userId);
    const serviceConfig = getServiceConfig(service);
    const currentState = await getServiceState(service);

    await updateServiceState(service, {
      status: "connected",
      granted_scopes: currentState.scopes,
      connected_at: new Date().toISOString(),
    });

    await writeAudit({
      service,
      action: "oauth_connect",
      userId: user.userId,
      result: "success",
      details: `Service connected via Auth0-backed GhostKey backend using ${serviceConfig.connection}.`,
      resultPayload: {
        connection: serviceConfig.connection,
        scopes: currentState.scopes,
      },
    });

    return res.json({
      status: "connected",
      service,
      auth0_connection: serviceConfig.connection,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/callback", (_req, res) => {
  res.type("html").send(`
    <html>
      <body style="font-family: sans-serif; background: #0b1110; color: #e8fff3; display: grid; place-items: center; min-height: 100vh;">
        <div>
          <h1>GhostKey Auth Callback</h1>
          <p>You can close this tab and return to the dashboard.</p>
        </div>
      </body>
    </html>
  `);
});

export default router;
