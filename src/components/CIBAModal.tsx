import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, Check, X, Smartphone, Timer, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CIBAStatus, ServiceId } from "@/lib/store";

interface CIBAModalProps {
  status: CIBAStatus;
  pendingAction: { service: ServiceId; action: string; context?: string } | null;
  onApprove: () => void;
  onDeny: () => void;
}

const TIMEOUT_SECONDS = 30;

export default function CIBAModal({ status, pendingAction, onApprove, onDeny }: CIBAModalProps) {
  const [secondsLeft, setSecondsLeft] = useState(TIMEOUT_SECONDS);

  useEffect(() => {
    if (status !== "pending") {
      setSecondsLeft(TIMEOUT_SECONDS);
      return;
    }

    setSecondsLeft(TIMEOUT_SECONDS);
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  if (status === "idle" || !pendingAction) return null;

  const progress = (secondsLeft / TIMEOUT_SECONDS) * 100;
  const isUrgent = secondsLeft <= 10;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-md mx-4 rounded-2xl border border-warning/30 bg-card p-6"
          style={{ boxShadow: "0 0 60px -12px hsl(38 92% 55% / 0.25)" }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-warning" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Step-Up Authentication</h3>
              <p className="text-xs text-muted-foreground font-mono">CIBA Push Notification</p>
            </div>
            {status === "pending" && (
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
                isUrgent
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "border-warning/30 bg-warning/10 text-warning"
              }`}>
                <Timer className="w-3 h-3" />
                <span className="text-xs font-mono font-bold">{secondsLeft}s</span>
              </div>
            )}
          </div>

          {/* Countdown bar */}
          {status === "pending" && (
            <div className="w-full h-1 rounded-full bg-muted mb-4 overflow-hidden">
              <motion.div
                className={`h-full rounded-full transition-colors ${
                  isUrgent ? "bg-destructive" : "bg-warning"
                }`}
                initial={{ width: "100%" }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: "linear" }}
              />
            </div>
          )}

          <div className="bg-muted rounded-lg p-4 mb-4 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <Smartphone className="w-4 h-4 text-accent" />
              <span className="text-sm text-accent font-mono">Device Notification</span>
            </div>
            <p className="text-sm text-foreground mb-2">
              <span className="font-semibold">GhostKey</span> wants to execute:
            </p>
            <div className="bg-background rounded-md p-3 font-mono text-xs">
              <div className="text-muted-foreground">Service: <span className="text-foreground">{pendingAction.service}</span></div>
              <div className="text-muted-foreground">Action: <span className="text-warning">{pendingAction.action}</span></div>
              {pendingAction.context && (
                <div className="text-muted-foreground mt-1">Context: <span className="text-foreground">{pendingAction.context}</span></div>
              )}
            </div>
          </div>

          {status === "pending" ? (
            <div className="flex gap-3">
              <Button
                onClick={onApprove}
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Check className="w-4 h-4 mr-2" />
                Approve
              </Button>
              <Button
                onClick={onDeny}
                variant="outline"
                className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                <X className="w-4 h-4 mr-2" />
                Deny
              </Button>
            </div>
          ) : status === "approved" ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 justify-center py-2 text-primary"
            >
              <Check className="w-5 h-5" />
              <span className="font-mono font-semibold">Approved — Executing</span>
            </motion.div>
          ) : status === "timeout" ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 justify-center py-2 text-warning"
            >
              <Clock className="w-5 h-5" />
              <span className="font-mono font-semibold">Timed Out — Retry Required</span>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 justify-center py-2 text-destructive"
            >
              <X className="w-5 h-5" />
              <span className="font-mono font-semibold">Denied — 403 Returned</span>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
