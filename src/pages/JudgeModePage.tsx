import { useState } from "react";
import { motion } from "framer-motion";
import { Presentation, Play, Loader2, Smartphone, ShieldOff, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { useGhostKey } from "@/lib/GhostKeyContext";
import type { ServiceId } from "@/lib/store";
import CIBAModal from "@/components/CIBAModal";
import AuditLogFeed from "@/components/AuditLogFeed";
import { Button } from "@/components/ui/button";

type FlowId = "vault" | "step-up" | "revoke";

export default function JudgeModePage() {
  const store = useGhostKey();
  const [runningFlow, setRunningFlow] = useState<FlowId | null>(null);

  const ensureConnected = async (serviceId: ServiceId) => {
    const service = store.services.find((entry) => entry.id === serviceId);
    if (service?.status === "connected") return;
    await store.connectService(serviceId);
  };

  const runVaultFlow = async () => {
    setRunningFlow("vault");
    try {
      await ensureConnected("google_calendar");
      await store.executeAction("google_calendar", "create_event", {
        title: "Judge walkthrough booking",
        date: "2026-04-06",
        time: "15:00",
      });
      toast.success("Calendar vault flow triggered.");
    } finally {
      setRunningFlow(null);
    }
  };

  const runStepUpFlow = async () => {
    setRunningFlow("step-up");
    try {
      await ensureConnected("gmail");
      await store.executeAction("gmail", "send_mass_email", {
        to: "500_recipients",
        subject: "Invoice $5000",
        body: "Judge mode step-up walkthrough.",
      });
      toast.info("Sensitive action sent for approval.");
    } finally {
      setRunningFlow(null);
    }
  };

  const runRevokeFlow = async () => {
    setRunningFlow("revoke");
    try {
      await ensureConnected("gmail");
      await store.revokeService("gmail");
      await store.executeAction("gmail", "send_email", {
        to: "judge@example.com",
        subject: "Revocation verification",
        body: "This call should fail after revocation.",
      });
      toast.info("Revocation flow completed. Check the audit log for the 403.");
    } finally {
      setRunningFlow(null);
    }
  };

  if (store.loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="space-y-4 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-mono">Preparing judge mode...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <CIBAModal
        status={store.cibaStatus}
        pendingAction={store.pendingAction}
        onApprove={store.approveCIBA}
        onDeny={store.denyCIBA}
      />

      <div className="space-y-8">
        <div className="space-y-3">
          <h1 className="flex items-center gap-3 text-2xl font-bold text-foreground">
            <Presentation className="h-6 w-6 text-accent" />
            Judge Mode
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            This route walks through the three demo moments in order: standard Token Vault execution,
            step-up approval, and revocation. Each card runs the corresponding flow inline.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border border-border bg-card p-4">
            <img
              src="/architecture.svg"
              alt="GhostKey architecture showing OpenClaw, GhostKey proxy, Auth0 Token Vault and upstream APIs"
              className="w-full rounded-xl border border-border bg-background"
            />
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground font-mono">Walkthrough order</p>
            <ol className="mt-3 space-y-3 text-sm text-foreground">
              <li>1. Run Calendar creation to show the normal vault path.</li>
              <li>2. Trigger a sensitive Gmail action and approve or deny it in the step-up modal.</li>
              <li>3. Revoke Gmail and immediately retry a Gmail action to surface CONSENT_REQUIRED.</li>
            </ol>
            <div className="mt-4 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
              Current step-up state: <span className="font-mono text-foreground">{store.cibaStatus}</span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <FlowCard
            title="Flow 1"
            subtitle="Standard Token Vault"
            description="Books a Calendar event through the proxy with no token in the request payload."
            icon={CalendarPlus}
            onRun={runVaultFlow}
            running={runningFlow === "vault"}
            buttonLabel="Run calendar flow"
          />
          <FlowCard
            title="Flow 2"
            subtitle="CIBA Step-Up"
            description="Triggers a sensitive Gmail action so the user approval state is visible during the demo."
            icon={Smartphone}
            onRun={runStepUpFlow}
            running={runningFlow === "step-up"}
            buttonLabel="Run step-up flow"
          />
          <FlowCard
            title="Flow 3"
            subtitle="Revocation"
            description="Revokes Gmail, then retries a Gmail call so the next action fails with consent required."
            icon={ShieldOff}
            onRun={runRevokeFlow}
            running={runningFlow === "revoke"}
            buttonLabel="Run revocation flow"
          />
        </div>

        <div>
          <h2 className="mb-4 text-lg font-semibold text-foreground">Latest audit evidence</h2>
          <AuditLogFeed entries={store.auditLog} maxEntries={12} />
        </div>
      </div>
    </>
  );
}

function FlowCard({
  title,
  subtitle,
  description,
  icon: Icon,
  onRun,
  running,
  buttonLabel,
}: {
  title: string;
  subtitle: string;
  description: string;
  icon: typeof Presentation;
  onRun: () => Promise<void>;
  running: boolean;
  buttonLabel: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card p-5"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-mono">{title}</p>
          <h3 className="text-lg font-semibold text-foreground">{subtitle}</h3>
        </div>
      </div>

      <p className="mt-4 text-sm text-muted-foreground">{description}</p>

      <Button onClick={onRun} disabled={running} className="mt-5 w-full">
        {running ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Play className="mr-2 h-4 w-4" />
        )}
        {buttonLabel}
      </Button>
    </motion.div>
  );
}
