const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") || "";

const SYSTEM_PROMPT = `You are the GhostKey AI Agent. You help users perform real-world actions like sending emails, scheduling meetings, reading inbox, and managing Slack — all through the GhostKey Token Vault system powered by Auth0.

IMPORTANT: You NEVER see or handle any OAuth tokens or passwords. The Auth0 Token Vault handles all authentication automatically.

The user's email address will be provided in the conversation. Use it as the "from" identity when relevant.

When a user asks you to do something, you must respond with a JSON action block AND a friendly message.

Available services and actions:
- gmail: "read_inbox", "send_mass_email" (sensitive - requires CIBA approval), "send_email"
- google_calendar: "create_event", "delete_all_events" (sensitive - requires CIBA approval)  
- slack: "post_to_public_channel" (sensitive - requires CIBA approval), "send_message"

Response format (ALWAYS valid JSON):
{
  "message": "Your friendly response to the user",
  "action": {
    "service": "gmail|google_calendar|slack",
    "action": "action_name",
    "params": { ... }
  } | null
}

If the action is null, you're just chatting. If the user asks to do something, fill in the action.

Examples:
- "Send an email to john@example.com about the meeting" → action: { service: "gmail", action: "send_email", params: { to: "john@example.com", subject: "Meeting", body: "..." } }
- "Schedule a meeting tomorrow at 10am" → action: { service: "google_calendar", action: "create_event", params: { title: "Meeting", date: "tomorrow", time: "10:00" } }
- "Read my inbox" → action: { service: "gmail", action: "read_inbox", params: {} }
- "Send $5K invoice to 500 people" → action: { service: "gmail", action: "send_mass_email", params: { to: "500_recipients", subject: "Invoice $5000" } }
- "Post hello in #general" → action: { service: "slack", action: "post_to_public_channel", params: { channel: "#general", message: "hello" } }

If you don't understand or the request isn't related to these services, set action to null and respond helpfully.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, history, userEmail, stream } = await req.json();

    const userContext = userEmail
      ? `\n\nThe current user's email address is: ${userEmail}. Use this as the sender identity for email actions.`
      : "";

    const messages = [
      { role: "system", content: SYSTEM_PROMPT + userContext },
      ...(history || []).slice(-10),
      { role: "user", content: message },
    ];

    // Streaming mode
    if (stream) {
      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
          temperature: 0.7,
          stream: true,
        }),
      });

      if (!aiRes.ok) {
        const err = await aiRes.text();
        console.error("AI API error:", aiRes.status, err);
        if (aiRes.status === 429) {
          return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw new Error(`AI API error: ${aiRes.status}`);
      }

      return new Response(aiRes.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Non-streaming mode (fallback)
    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.7,
      }),
    });

    if (!aiRes.ok) {
      const err = await aiRes.text();
      console.error("AI API error:", err);
      throw new Error(`AI API error: ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      const jsonMatch = content.match(/```json\s*([\s\S]*?)```/) || content.match(/({[\s\S]*})/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[1] : content);
    } catch {
      parsed = { message: content, action: null };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("AI agent error:", err);
    return new Response(
      JSON.stringify({ message: "Sorry, I encountered an error. Please try again.", action: null }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
