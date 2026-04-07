import { useState } from "react";
import { Zap, Loader2 } from "lucide-react";
import { useGhostKey } from "@/lib/GhostKeyContext";
import type { ServiceId } from "@/lib/store";
import CIBAModal from "@/components/CIBAModal";
import AuditLogFeed from "@/components/AuditLogFeed";
import { motion } from "framer-motion";
import { toast } from "sonner";

const demoActions = [
  {
    label: "📅 Book Meeting",
    service: "google_calendar" as ServiceId,
    action: "create_event",
    params: { title: "Team Standup", date: "2024-01-15", time: "10:00" },
    description: "Standard Vault flow — token fetched, injected, stripped.",
  },
  {
    label: "✉️ Read Inbox",
    service: "gmail" as ServiceId,
    action: "read_inbox",
    params: {},
    description: "Standard Vault flow — direct execution.",
  },
  {
    label: "🔥 Send $5K Invoice to 500 Recipients",
    service: "gmail" as ServiceId,
    action: "send_mass_email",
    params: { to: "500_recipients", subject: "Invoice $5000" },
    description: "CIBA step-up — push notification fires!",
    sensitive: true,
  },
  {
    label: "💬 Post to Public Channel",
    service: "slack" as ServiceId,
    action: "post_to_public_channel",
    params: { channel: "#general", message: "Hello from GhostKey!" },
    description: "CIBA step-up — requires approval.",
    sensitive: true,
  },
  {
    label: "📅 Delete All Events",
    service: "google_calendar" as ServiceId,
    action: "delete_all_events",
    params: {},
    description: "CIBA step-up — destructive action.",
    sensitive: true,
  },
];

export default function DemoPage() {
  const store = useGhostKey();
  const [selectedAction, setSelectedAction] = useState<number | null>(null);
  const [executingIndex, setExecutingIndex] = useState<number | null>(null);

  if (store.loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground font-mono">Loading services…</p>
        </div>
      </div>
    );
  }

  const handleExecute = async (index: number) => {
    const action = demoActions[index];
    setSelectedAction(index);
    setExecutingIndex(index);
    try {
      await store.executeAction(action.service, action.action, action.params);
      if (action.sensitive) {
        toast.info(`🔐 CIBA step-up triggered for ${action.label}`);
      } else {
        toast.success(`✅ ${action.label} executed via Token Vault`);
      }
    } catch {
      toast.error(`Failed to execute ${action.label}`);
    } finally {
      setExecutingIndex(null);
    }
  };

  return (
    <>
      <CIBAModal
        status={store.cibaStatus}
        pendingAction={store.pendingAction}
        onApprove={store.approveCIBA}
        onDeny={store.denyCIBA}
      />

      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Zap className="w-6 h-6 text-warning" />
            Live Demo — OpenClaw Bridge
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Simulate agent tool-calls. Zero tokens in the payload — ever.
          </p>
        </div>

        {/* Agent Payload Preview */}
        {selectedAction !== null && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-accent/20 bg-card p-4 glow-cyan"
          >
            <p className="text-xs text-accent font-mono mb-2">
              POST /agent/act{demoActions[selectedAction].sensitive ? "/sensitive" : ""} — OpenClaw Payload
            </p>
            <pre className="text-xs font-mono text-foreground bg-background rounded-lg p-3 overflow-x-auto">
{JSON.stringify({
  service: demoActions[selectedAction].service,
  action: demoActions[selectedAction].action,
  params: demoActions[selectedAction].params,
  token: "⛔ NEVER INCLUDED",
}, null, 2)}
            </pre>
          </motion.div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {demoActions.map((action, i) => {
            const service = store.services.find((s) => s.id === action.service);
            const isConnected = service?.status === "connected";

            return (
              <button
                key={i}
                onClick={() => handleExecute(i)}
                disabled={!isConnected || executingIndex === i}
                className={`text-left p-4 rounded-xl border transition-all ${
                  action.sensitive
                    ? "border-warning/20 hover:border-warning/40 hover:bg-warning/5"
                    : "border-border hover:border-primary/30 hover:bg-primary/5"
                } ${!isConnected ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm text-foreground flex items-center gap-2">
                    {action.label}
                    {executingIndex === i && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                  </span>
                  {action.sensitive && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-warning bg-warning/10">
                      CIBA
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{action.description}</p>
                {!isConnected && (
                  <p className="text-xs text-destructive mt-1 font-mono">Connect {action.service} first</p>
                )}
              </button>
            );
          })}
        </div>

        {/* Live Audit */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-4">Live Audit Feed</h2>
          <AuditLogFeed entries={store.auditLog} maxEntries={10} />
        </div>
      </div>
    </>
  );
}
