import { auth } from "express-oauth2-jwt-bearer";
import { ManagementClient } from "auth0";
import { config } from "./config.js";

export const requireAuth = auth({
  audience: config.auth0.audience,
  issuerBaseURL: `https://${config.auth0.domain}/`,
  tokenSigningAlg: "RS256",
});

let managementClient;

async function getManagementAccessToken() {
  const response = await fetch(`https://${config.auth0.domain}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: config.auth0.clientId,
      client_secret: config.auth0.clientSecret,
      audience: config.auth0.managementAudience,
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown Auth0 token error");
    throw new Error(`Auth0 management token request failed: ${errorText}`);
  }

  const payload = await response.json();
  return payload.access_token;
}

export function getManagementClient() {
  if (!managementClient) {
    managementClient = new ManagementClient({
      domain: config.auth0.domain,
      clientId: config.auth0.clientId,
      clientSecret: config.auth0.clientSecret,
      audience: config.auth0.managementAudience,
    });
  }

  return managementClient;
}

export function getUserContext(req) {
  const payload = req.auth?.payload || {};

  return {
    userId: payload.sub,
    email: payload.email || req.headers["x-user-email"] || null,
    name: payload.name || null,
    picture: payload.picture || null,
    accessToken:
      typeof req.headers.authorization === "string"
        ? req.headers.authorization.replace(/^Bearer\s+/i, "")
        : null,
  };
}

export async function getVaultConnectivity() {
  try {
    return Boolean(await getManagementAccessToken());
  } catch {
    return false;
  }
}

export async function getUserConnections({ userId, email }) {
  try {
    if (!userId && !email) {
      return new Set();
    }

    const accessToken = await getManagementAccessToken();
    let user = null;

    if (userId) {
      const response = await fetch(
        `https://${config.auth0.domain}/api/v2/users/${encodeURIComponent(userId)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (response.ok) {
        user = await response.json();
      }
    }

    if (!user && email) {
      const response = await fetch(
        `https://${config.auth0.domain}/api/v2/users-by-email?email=${encodeURIComponent(email)}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );

      if (response.ok) {
        const users = await response.json();
        user = Array.isArray(users) && users.length > 0 ? users[0] : null;
      }
    }

    const identities = Array.isArray(user?.identities) ? user.identities : [];
    const connections = identities
      .map((identity) => (typeof identity?.connection === "string" ? identity.connection : null))
      .filter(Boolean);

    return new Set(connections);
  } catch {
    return new Set();
  }
}
