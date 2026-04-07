import { Router } from "express";
import { getUserContext } from "../auth0.js";
import { listDelegations, upsertDelegation } from "../consents.js";
import { writeAudit } from "../audit.js";
import { isServiceId } from "../service-registry.js";
import { jsonError, normalizeStringArray } from "../utils.js";

const router = Router();

router.get("/delegate", async (req, res, next) => {
  try {
    const user = getUserContext(req);
    const delegations = await listDelegations(user.userId);
    res.json(delegations);
  } catch (error) {
    next(error);
  }
});

router.post("/delegate", async (req, res, next) => {
  try {
    const user = getUserContext(req);
    const { grantedTo, service, scopes } = req.body;

    if (!grantedTo || typeof grantedTo !== "string") {
      return jsonError(res, 400, "INVALID_DELEGATE", "Missing Auth0 delegate user id.");
    }

    if (!isServiceId(service)) {
      return jsonError(res, 400, "INVALID_SERVICE", "Unknown service.");
    }

    const delegation = await upsertDelegation({
      grantedBy: user.userId,
      grantedTo,
      service,
      scopes: normalizeStringArray(scopes),
    });

    await writeAudit({
      service,
      action: "delegate_consent",
      userId: user.userId,
      result: "success",
      details: `Delegated ${service} approval to ${grantedTo}.`,
      resultPayload: delegation,
    });

    res.status(201).json(delegation);
  } catch (error) {
    next(error);
  }
});

export default router;
