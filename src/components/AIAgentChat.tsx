import { useState, useRef, useEffect } from "react";
import { Bot, Send, X, Loader2, Zap, ChevronRight, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useGhostKey } from "@/lib/GhostKeyContext";
import { useAuth } from "@/lib/AuthContext";
import { apiUrl } from "@/lib/api";
import { toast } from "sonner";
import type { ServiceId } from "@/lib/store";

interface Message {
  role: "user" | "assistant";
  content: string;
  action?: {
    service: ServiceId;
    action: string;
    params: Record<string, unknown>;
  } | null;
  actionStatus?: "pending" | "executing" | "done" | "error";
}

const quickActions = [
  { label: "📬 Read my inbox", msg: "Read my inbox" },
  { label: "📅 Book a meeting", msg: "Schedule a team standup meeting tomorrow at 10am" },
  { label: "✉️ Send an email", msg: "Send an email to teammate@example.com about the project update" },
  { label: "💬 Post in Slack", msg: "Post 'Hello team!' in #general channel" },
];

export default function AIAgentChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const store = useGhostKey();
  const { user, getAccessToken } = useAuth();

  const userEmail = user?.email ?? null;

  // Set initial greeting with user email
  useEffect(() => {
    setMessages([
      {
        role: "assistant",
        content: `Hey${user?.email ? ` ${user.email.split("@")[0]}` : ""}! 👋 I'm the GhostKey AI Agent powered by Auth0 Token Vault.\n\nI can send emails, schedule meetings, and post to Slack — all without ever seeing your tokens.${userEmail ? `\n\nYour identity: **${userEmail}**` : "\n\nSign in with your linked identity to run actions against Auth0-backed connections."}\n\nWhat would you like me to do?`,
        action: null,
      },
    ]);
  }, [user, userEmail]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const executeAction = async (action: Message["action"], msgIndex: number) => {
    if (!action) return;

    setMessages((prev) =>
      prev.map((m, i) => (i === msgIndex ? { ...m, actionStatus: "executing" } : m))
    );

    try {
      await store.executeAction(action.service, action.action, action.params);
      const isSensitive = ["send_mass_email", "delete_all_events", "post_to_public_channel", "send_dm_to_all_members"].includes(action.action);

      if (isSensitive) {
        toast.info(`🔐 CIBA step-up triggered for ${action.action}`);
      } else {
        toast.success(`✅ ${action.action} executed via Auth0 Token Vault`);
      }

      setMessages((prev) =>
        prev.map((m, i) => (i === msgIndex ? { ...m, actionStatus: "done" } : m))
      );
    } catch {
      toast.error(`Failed to execute ${action.action}`);
      setMessages((prev) =>
        prev.map((m, i) => (i === msgIndex ? { ...m, actionStatus: "error" } : m))
      );
    }
  };

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    setInput("");

    const userMsg: Message = { role: "user", content: msg };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const token = await getAccessToken();

      const res = await fetch(apiUrl("ai-agent"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: msg, history, userEmail: userEmail || undefined, stream: true }),
      });

      if (!res.ok) {
        // Try to read error message from response body
        try {
          const errData = await res.json();
          if (errData.message) {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: errData.message, action: null },
            ]);
            return;
          }
        } catch { /* fallthrough */ }
        throw new Error("Failed to start stream");
      }

      if (!res.body) {
        throw new Error("No response body");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let fullContent = "";
      let streamDone = false;

      // Add empty assistant message
      setMessages((prev) => [...prev, { role: "assistant", content: "", action: null }]);

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              fullContent += content;
              const captured = fullContent;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) =>
                    i === prev.length - 1 ? { ...m, content: captured } : m
                  );
                }
                return prev;
              });
            }
          } catch {
            // Partial JSON, put back
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (raw.startsWith(":") || raw.trim() === "") continue;
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) fullContent += content;
          } catch { /* ignore */ }
        }
      }

      // Try to parse the full streamed content as JSON to extract action
      let action: Message["action"] = null;
      try {
        const jsonMatch = fullContent.match(/```json\s*([\s\S]*?)```/) || fullContent.match(/({[\s\S]*})/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[1]);
          if (parsed.action) action = parsed.action;
          if (parsed.message) fullContent = parsed.message;
        }
      } catch {
        // Not JSON, use raw content as message
      }

      // Update final message with action if found
      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1
            ? { ...m, content: fullContent, action, actionStatus: action ? "pending" : undefined }
            : m
        )
      );
    } catch {
      setMessages((prev) => [
        ...prev.filter((m) => !(m.role === "assistant" && m.content === "")),
        { role: "assistant", content: "Sorry, something went wrong. Please try again.", action: null },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* FAB */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-110 transition-transform glow-green"
          >
            <Bot className="w-6 h-6" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-4 right-4 z-50 w-[420px] max-w-[calc(100vw-2rem)] h-[600px] max-h-[calc(100vh-6rem)] rounded-2xl border border-border bg-card shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-sidebar">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">GhostKey Agent</p>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    Auth0 Vault • Streaming
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-[10px] text-primary font-mono">
                  <User className="w-3 h-3" />
                  {userEmail ? userEmail.split("@")[0] : "guest"}
                </div>
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    {msg.action && (
                      <div className="mt-2 pt-2 border-t border-border/30">
                        <div className="flex items-center gap-1 text-[10px] font-mono opacity-70 mb-1.5">
                          <Zap className="w-3 h-3" />
                          {msg.action.service} → {msg.action.action}
                        </div>
                        {msg.actionStatus === "pending" && (
                          <button
                            onClick={() => executeAction(msg.action, i)}
                            className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 transition-colors"
                          >
                            Execute via Vault <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                        {msg.actionStatus === "executing" && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Loader2 className="w-3 h-3 animate-spin" /> Executing...
                          </span>
                        )}
                        {msg.actionStatus === "done" && (
                          <span className="text-xs text-primary font-mono">✅ Done</span>
                        )}
                        {msg.actionStatus === "error" && (
                          <span className="text-xs text-destructive font-mono">❌ Failed</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-xl px-3 py-2">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            {messages.length <= 1 && (
              <div className="px-4 pb-2 flex flex-wrap gap-1.5">
                {quickActions.map((qa) => (
                  <button
                    key={qa.label}
                    onClick={() => sendMessage(qa.msg)}
                    className="text-xs px-2.5 py-1.5 rounded-full border border-border bg-muted/50 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
                  >
                    {qa.label}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="p-3 border-t border-border">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="Ask me to send email, book meeting..."
                  className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/50"
                  disabled={loading}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || loading}
                  className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[9px] text-muted-foreground text-center mt-1.5 font-mono">
                🔒 Zero tokens in payload • Auth0 Token Vault{userEmail ? ` • ${userEmail}` : ""}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
