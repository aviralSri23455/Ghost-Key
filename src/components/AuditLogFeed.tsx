import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { AuditEntry } from "@/lib/store";
import { Shield, ShieldAlert, ShieldOff, ShieldCheck, AlertTriangle } from "lucide-react";

const resultConfig: Record<string, { color: string; icon: typeof Shield; label: string }> = {
  success: { color: "text-primary", icon: ShieldCheck, label: "Success" },
  blocked: { color: "text-destructive", icon: ShieldOff, label: "Blocked" },
  revoked: { color: "text-warning", icon: ShieldOff, label: "Revoked" },
  step_up_approved: { color: "text-primary", icon: ShieldAlert, label: "Step-Up ✓" },
  step_up_denied: { color: "text-destructive", icon: ShieldAlert, label: "Step-Up ✗" },
  error: { color: "text-destructive", icon: AlertTriangle, label: "Error" },
};

interface AuditLogFeedProps {
  entries: AuditEntry[];
  maxEntries?: number;
  serviceFilter?: string;
}

export default function AuditLogFeed({ entries, maxEntries = 50, serviceFilter }: AuditLogFeedProps) {
  const filtered = entries
    .filter((e) => !serviceFilter || e.service === serviceFilter)
    .slice(0, maxEntries);

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Shield className="w-8 h-8 mx-auto mb-3 opacity-30" />
        <p className="text-sm font-mono">No audit entries yet</p>
        <p className="text-xs mt-1">Actions will appear here in real-time</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {filtered.map((entry) => {
          const config = resultConfig[entry.result] || resultConfig.error;
          const Icon = config.icon;

          return (
            <motion.div
              key={entry.id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border hover:border-muted-foreground/20 transition-colors"
            >
              <div className={`mt-0.5 ${config.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-semibold text-foreground">
                    {entry.action}
                  </span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${config.color} bg-current/10`}>
                    {config.label}
                  </span>
                  {entry.stepUp && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-warning bg-warning/10">
                      CIBA
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground font-mono">
                  <span>{entry.service}</span>
                  <span>·</span>
                  <span>{entry.tokenHash}</span>
                  <span>·</span>
                  <span>{formatDistanceToNow(entry.timestamp, { addSuffix: true })}</span>
                </div>
                {entry.details && (
                  <p className="text-xs text-muted-foreground mt-1">{entry.details}</p>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
