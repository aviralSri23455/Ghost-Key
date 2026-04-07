import { z } from "zod";
import { getServiceConfig, isServiceId, sensitiveActionDefaults } from "./service-registry.js";
import { getTokenFromVault } from "./vault.js";
import { normalizeStringArray } from "./utils.js";

const toolPayloadSchema = z.object({
  service: z.string(),
  action: z.string().min(1),
  params: z.record(z.any()).optional(),
});

function encodeEmail(to, subject, body) {
  const message = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ].join("\r\n");

  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function validateToolCallPayload(payload) {
  const parsed = toolPayloadSchema.parse(payload);
  if (!isServiceId(parsed.service)) {
    throw new Error("Invalid service. Expected gmail, google_calendar, or slack.");
  }

  return {
    service: parsed.service,
    action: parsed.action.trim(),
    params: parsed.params || {},
  };
}

export async function executeServiceAction({
  service,
  action,
  params,
  userAccessToken,
  userEmail,
}) {
  const config = getServiceConfig(service);
  const accessToken = await getTokenFromVault({
    userAccessToken,
    service,
    connection: config.connection,
    scopes: config.scopes,
    loginHint: userEmail || undefined,
  });

  if (service === "gmail") {
    return executeGmailAction(action, params, accessToken);
  }

  if (service === "google_calendar") {
    return executeCalendarAction(action, params, accessToken);
  }

  if (service === "slack") {
    return executeSlackAction(action, params, accessToken);
  }

  throw new Error(`Unsupported service ${service}.`);
}

async function executeGmailAction(action, params, accessToken) {
  if (action === "send_email" || action === "send_mass_email") {
    const to = typeof params.to === "string" ? params.to : "";
    const subject = typeof params.subject === "string" ? params.subject : "GhostKey";
    const body = typeof params.body === "string" ? params.body : "Sent via GhostKey";

    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        raw: encodeEmail(to, subject, body),
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error?.message || `Gmail API error: ${response.status}`);
    }

    return {
      messageId: result.id,
      threadId: result.threadId,
      to,
      subject,
      sent: true,
    };
  }

  if (action === "read_inbox") {
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=10", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error?.message || `Gmail API error: ${response.status}`);
    }

    return {
      count: result.messages?.length || 0,
      messages: result.messages || [],
    };
  }

  throw new Error(`Unsupported Gmail action ${action}.`);
}

async function executeCalendarAction(action, params, accessToken) {
  if (action === "create_event") {
    const title = typeof params.title === "string" ? params.title : "GhostKey event";
    const date = typeof params.date === "string" ? params.date : new Date().toISOString().slice(0, 10);
    const time = typeof params.time === "string" ? params.time : "10:00";
    const start = `${date}T${time}:00`;
    const endDate = new Date(start);
    endDate.setHours(endDate.getHours() + 1);

    const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: title,
        start: { dateTime: new Date(start).toISOString() },
        end: { dateTime: endDate.toISOString() },
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error?.message || `Calendar API error: ${response.status}`);
    }

    return {
      eventId: result.id,
      title: result.summary,
      start: result.start?.dateTime || result.start?.date,
      end: result.end?.dateTime || result.end?.date,
      link: result.htmlLink,
    };
  }

  throw new Error(`Unsupported Google Calendar action ${action}.`);
}

async function executeSlackAction(action, params, accessToken) {
  if (action === "send_message" || action === "post_to_public_channel") {
    const channel = typeof params.channel === "string" ? params.channel : "#general";
    const message = typeof params.message === "string" ? params.message : "Sent via GhostKey";

    const postResponse = await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        channel,
        text: message,
      }),
    });

    const postResult = await postResponse.json();
    if (!postResponse.ok || !postResult.ok) {
      throw new Error(postResult.error || `Slack API error: ${postResponse.status}`);
    }

    let permalink = null;
    const permalinkResponse = await fetch("https://slack.com/api/chat.getPermalink", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        channel: postResult.channel,
        message_ts: postResult.ts,
      }),
    });

    const permalinkResult = await permalinkResponse.json();
    if (permalinkResponse.ok && permalinkResult.ok) {
      permalink = permalinkResult.permalink;
    }

    return {
      channel: postResult.channel,
      ts: postResult.ts,
      permalink,
    };
  }

  throw new Error(`Unsupported Slack action ${action}.`);
}

export function getSensitiveActions(row) {
  return normalizeStringArray(row.sensitive_actions, sensitiveActionDefaults[row.id] || []);
}
