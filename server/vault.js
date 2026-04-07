import { createRequire } from "node:module";
import { config } from "./config.js";
import { getToolContext } from "./utils.js";

const require = createRequire(import.meta.url);
const {
  TokenVaultAuthorizerBase,
  getAccessTokenFromTokenVault,
  SUBJECT_TOKEN_TYPES,
} = require("@auth0/ai/TokenVault");
const { MemoryStore } = require("@auth0/ai/stores");
const { TokenVaultInterrupt } = require("@auth0/ai/interrupts");

const store = new MemoryStore();

export async function getTokenFromVault({
  userAccessToken,
  service,
  connection,
  scopes,
  loginHint,
}) {
  if (!userAccessToken) {
    throw new Error("Missing Auth0 access token for Token Vault exchange.");
  }

  const authorizer = new TokenVaultAuthorizerBase(
    {
      domain: config.auth0.domain,
      clientId: config.auth0.clientId,
      clientSecret: config.auth0.clientSecret,
    },
    {
      accessToken: () => userAccessToken,
      subjectTokenType: SUBJECT_TOKEN_TYPES.SUBJECT_TYPE_ACCESS_TOKEN,
      connection,
      scopes,
      loginHint: () => loginHint,
      store,
    },
  );

  const wrapped = authorizer.protect(
    () => getToolContext(service, "getTokenFromVault"),
    async () => getAccessTokenFromTokenVault(),
  );

  try {
    return await wrapped();
  } catch (error) {
    if (error instanceof TokenVaultInterrupt) {
      throw new Error(`Token Vault authorization required for ${connection}.`);
    }
    throw error;
  }
}

export async function hasVaultAccessForService({
  userAccessToken,
  service,
  connection,
  scopes,
  loginHint,
}) {
  try {
    const token = await getTokenFromVault({
      userAccessToken,
      service,
      connection,
      scopes,
      loginHint,
    });

    return Boolean(token);
  } catch {
    return false;
  }
}

export async function revokeUpstreamToken({
  service,
  userAccessToken,
  connection,
  scopes,
  loginHint,
}) {
  const token = await getTokenFromVault({
    userAccessToken,
    service,
    connection,
    scopes,
    loginHint,
  });

  if (service === "gmail" || service === "google_calendar") {
    const response = await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ token }),
    });

    if (!response.ok) {
      throw new Error(`Google revoke failed with status ${response.status}.`);
    }

    return { revoked: true, provider: "google" };
  }

  if (service === "slack") {
    const response = await fetch("https://slack.com/api/auth.revoke", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ test: "false" }),
    });

    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error || `Slack revoke failed with status ${response.status}.`);
    }

    return { revoked: true, provider: "slack" };
  }

  throw new Error(`Unsupported revoke flow for service ${service}.`);
}
