import { Router } from "express";
import { getUserContext } from "../auth0.js";
import {
  getSensitiveActionsConfig,
  updateSensitiveActionsConfig,
} from "../services.js";
import { isServiceId } from "../service-registry.js";
import { writeAudit } from "../audit.js";
import { jsonError, normalizeStringArray } from "../utils.js";

const router = Router();

router.get("/sensitive-actions", async (_req, res, next) => {
  try {
    const config = await getSensitiveActionsConfig();
    res.json({ services: config });
  } catch (error) {
    next(error);
  }
});

router.put("/sensitive-actions", async (req, res, next) => {
  try {
    const user = getUserContext(req);
    const updates = [];

    if (isServiceId(req.body.service)) {
      updates.push({
        serviceId: req.body.service,
        actions: normalizeStringArray(req.body.sensitive_actions),
      });
    }

    if (req.body.config && typeof req.body.config === "object") {
      Object.entries(req.body.config).forEach(([serviceId, actions]) => {
        if (isServiceId(serviceId)) {
          updates.push({
            serviceId,
            actions: normalizeStringArray(actions),
          });
        }
      });
    }

    if (!updates.length) {
      return jsonError(res, 400, "INVALID_CONFIG", "No valid sensitive action update was provided.");
    }

    for (const update of updates) {
      await updateSensitiveActionsConfig(update.serviceId, update.actions);
      await writeAudit({
        service: update.serviceId,
        action: "update_sensitive_actions",
        userId: user.userId,
        result: "success",
        details: `Updated ${update.serviceId} sensitive action policy.`,
        resultPayload: {
          sensitive_actions: update.actions,
        },
      });
    }

    res.json({
      status: "updated",
      services: Object.fromEntries(updates.map((update) => [update.serviceId, update.actions])),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
