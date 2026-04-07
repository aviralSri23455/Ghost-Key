import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fallbackSensitiveActions = {
  gmail: ["send_mass_email", "delete_thread", "send_with_attachment_over_5mb"],
  google_calendar: ["delete_all_events", "share_calendar_externally"],
  slack: ["post_to_public_channel", "send_dm_to_all_members"],
};

function loadSensitiveActionConfig() {
  try {
    const filePath = path.resolve(__dirname, "..", "config", "sensitive_actions.json");
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return fallbackSensitiveActions;
  }
}

export const sensitiveActionDefaults = loadSensitiveActionConfig();

export const serviceRegistry = {
  gmail: {
    id: "gmail",
    name: "Gmail",
    icon: "📧",
    connection: "google-oauth2",
    scopes: [
      "openid",
      "profile",
      "email",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.modify",
    ],
  },
  google_calendar: {
    id: "google_calendar",
    name: "Google Calendar",
    icon: "📅",
    connection: "google-oauth2",
    scopes: [
      "openid",
      "profile",
      "email",
      "https://www.googleapis.com/auth/calendar",
    ],
  },
  slack: {
    id: "slack",
    name: "Slack",
    icon: "💬",
    connection: "slack",
    scopes: [
      "openid",
      "profile",
      "email",
      "channels:read",
      "chat:write",
      "users:read",
    ],
  },
};

export const serviceIds = Object.keys(serviceRegistry);

export function isServiceId(value) {
  return typeof value === "string" && value in serviceRegistry;
}

export function getServiceConfig(serviceId) {
  if (!isServiceId(serviceId)) {
    throw new Error(`Unknown service: ${serviceId}`);
  }
  return serviceRegistry[serviceId];
}
