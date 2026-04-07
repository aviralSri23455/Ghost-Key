import { createRequire } from "node:module";
import { config } from "./config.js";
import { getToolContext } from "./utils.js";
import { getDelegationForService } from "./consents.js";

const require = createRequire(import.meta.url);
const { AsyncAuthorizerBase } = require("@auth0/ai/AsyncAuthorization");
const {
  AccessDeniedInterrupt,
  UserDoesNotHavePushNotificationsInterrupt,
} = require("@auth0/ai/interrupts");
const { MemoryStore } = require("@auth0/ai/stores");
import crypto from "node:crypto";

const store = new MemoryStore();
const browserFallbackApprovals = new Map();

export async function requestStepUp({
  ownerUserId,
  ownerEmail,
  service,
  action,
}) {
  const delegation = await getDelegationForService(ownerUserId, service);
  const approvalUserId = delegation?.granted_to || ownerUserId;

  if (config.auth0.cibaMode !== "push") {
    const requestId = crypto.randomUUID();
    browserFallbackApprovals.set(requestId, {
      requestId,
      ownerUserId,
      approvalUserId,
      service,
      action,
      createdAt: new Date().toISOString(),
    });
    return {
      mode: "browser",
      requestId,
      approvalUserId,
    };
  }

  const authorizer = new AsyncAuthorizerBase(
    {
      domain: config.auth0.domain,
      clientId: config.auth0.clientId,
      clientSecret: config.auth0.clientSecret,
    },
    {
      store,
      audience: config.auth0.audience,
      scopes: ["openid", "profile", "email"],
      userID: () => approvalUserId,
      bindingMessage: () => `GhostKey approval: ${service} ${action}`,
      requestedExpiry: 90,
      onAuthorizationRequest: "block",
    },
  );

  const wrapped = authorizer.protect(
    () => getToolContext(service, action),
    async () => ({
      approved: true,
      approvalUserId,
    }),
  );

  try {
    return {
      mode: "push",
      ...(await wrapped()),
    };
  } catch (error) {
    if (error instanceof AccessDeniedInterrupt) {
      return {
        mode: "push",
        approved: false,
        approvalUserId,
        error: "STEP_UP_DENIED",
      };
    }

    if (error instanceof UserDoesNotHavePushNotificationsInterrupt) {
      return {
        mode: "push",
        approved: false,
        approvalUserId,
        error: "STEP_UP_UNAVAILABLE",
        message: ownerEmail
          ? `No Guardian push device is registered for ${ownerEmail}.`
          : "No Guardian push device is registered for this user.",
      };
    }

    throw error;
  }
}

export function resolveBrowserFallbackStepUp({ requestId, userId, service, action, approved }) {
  if (requestId) {
    const pending = browserFallbackApprovals.get(requestId);
    if (!pending) {
      return null;
    }

    browserFallbackApprovals.delete(requestId);
    return {
      ...pending,
      approved,
    };
  }

  for (const [pendingRequestId, pending] of browserFallbackApprovals.entries()) {
    if (
      pending.approvalUserId === userId &&
      pending.service === service &&
      pending.action === action
    ) {
      browserFallbackApprovals.delete(pendingRequestId);
      return {
        ...pending,
        approved,
      };
    }
  }

  return null;
}
