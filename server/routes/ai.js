import { Router } from "express";
import { config } from "../config.js";
import { getUserContext } from "../auth0.js";

const router = Router();

const SYSTEM_PROMPT = `You are the GhostKey AI Agent. You help users perform real-world actions like sending emails, scheduling meetings, reading inbox, and managing Slack through GhostKey.

IMPORTANT: You never handle OAuth tokens or passwords directly. Auth0 Token Vault handles token exchange.

Available services and actions:
- gmail: read_inbox, send_email, send_mass_email
- google_calendar: create_event
- slack: send_message, post_to_public_channel

Always respond with valid JSON:
{
  "message": "Friendly user-facing response",
  "action": {
    "service": "gmail|google_calendar|slack",
    "action": "action_name",
    "params": {}
  } | null
}`;

router.post("/", async (req, res, next) => {
  try {
    // Check for OpenAI API key first, then fall back to AI Gateway
    const apiKey = config.openaiApiKey || config.aiGatewayApiKey;
    const useOpenAI = Boolean(config.openaiApiKey);

    if (!apiKey) {
      return res.status(503).json({
        message: "The AI agent is not available right now — the OpenAI API key is not configured. You can still use the demo actions on the Live Demo page to test the Token Vault flow.",
        action: null,
      });
    }

    const { message, history, stream } = req.body;
    const user = getUserContext(req);

    const messages = [
      {
        role: "system",
        content: `${SYSTEM_PROMPT}\n\nCurrent user email: ${user.email || "unknown"}`,
      },
      ...(history || []).slice(-10),
      { role: "user", content: message },
    ];

    const apiUrl = useOpenAI 
      ? "https://api.openai.com/v1/chat/completions"
      : "https://ai.gateway.lovable.dev/v1/chat/completions";
    
    const model = useOpenAI ? "gpt-4o-mini" : "google/gemini-3-flash-preview";

    const aiResponse = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        stream: Boolean(stream),
      }),
    });

    if (!aiResponse.ok) {
      const text = await aiResponse.text();
      throw new Error(`AI API error: ${aiResponse.status} ${text}`);
    }

    if (stream) {
      res.setHeader("Content-Type", "text/event-stream");
      return aiResponse.body.pipeTo(
        new WritableStream({
          write(chunk) {
            res.write(Buffer.from(chunk));
          },
          close() {
            res.end();
          },
        }),
      );
    }

    const data = await aiResponse.json();
    const content = data.choices?.[0]?.message?.content || "";

    try {
      const match = content.match(/```json\s*([\s\S]*?)```/) || content.match(/({[\s\S]*})/);
      return res.json(JSON.parse(match ? match[1] : content));
    } catch {
      return res.json({ message: content, action: null });
    }
  } catch (error) {
    next(error);
  }
});

export default router;
