import { useState } from "react";
import { Shield, Activity, Lock, Unlock, Loader2, RotateCcw } from "lucide-react";
import ServiceCard from "@/components/ServiceCard";
import AuditLogFeed from "@/components/AuditLogFeed";
import CIBAModal from "@/components/CIBAModal";
import { useGhostKey } from "@/lib/GhostKeyContext";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const store = useGhostKey();
  const connectedCount = store.services.filter((service) => service.status === "connected").length;
  const [resetting, setResetting] = useState(false);

  const handleReset = async () => {
    setResetting(true);
    try {
      await store.resetDemo();
    } finally {
      setResetting(false);
    }
  };

  if (store.loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="space-y-4 text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-mono">Loading Token Vault...</p>
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
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-3 text-2xl font-bold text-foreground">
              <Shield className="h-6 w-6 text-primary" />
              Connected Services
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Token Vault manages all OAuth tokens. Zero tokens ever reach the AI agent.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground font-mono">
                Health: {store.vaultHealth.vault}
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={resetting}
            className="border-muted-foreground/20 text-muted-foreground hover:text-foreground hover:border-primary/30 text-xs"
          >
            {resetting ? (
              <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
            ) : (
              <RotateCcw className="mr-1.5 h-3 w-3" />
            )}
            Reset Demo
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard icon={Lock} label="Vault Connections" value={connectedCount} color="primary" />
          <StatCard icon={Activity} label="Audit Events" value={store.auditLog.length} color="accent" />
          <StatCard
            icon={Unlock}
            label="Revocations"
            value={store.auditLog.filter((entry) => entry.result === "revoked").length}
            color="warning"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-card p-4 md:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground font-mono">Vault status</p>
            <p className="mt-1 text-lg font-semibold text-foreground capitalize">{store.vaultHealth.vault}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-mono">Connected services</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{store.vaultHealth.connectedServices}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-mono">Last checked</p>
            <p className="mt-1 text-lg font-semibold text-foreground">
              {store.vaultHealth.checkedAt ? store.vaultHealth.checkedAt.toLocaleTimeString() : "Unavailable"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {store.services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onConnect={() => store.connectService(service.id)}
              onRevoke={() => store.revokeService(service.id)}
            />
          ))}
        </div>

        <div>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground">
            <Activity className="h-4 w-4 text-accent" />
            Recent Activity
          </h2>
          <AuditLogFeed entries={store.auditLog} maxEntries={5} />
        </div>
      </div>
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Shield;
  label: string;
  value: number;
  color: string;
}) {
  const colorClasses = {
    primary: "text-primary",
    accent: "text-accent",
    warning: "text-warning",
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon className={`h-4 w-4 ${colorClasses[color as keyof typeof colorClasses] || "text-primary"}`} />
        <span className="text-xs text-muted-foreground font-mono">{label}</span>
      </div>
      <p className={`text-2xl font-bold font-mono ${colorClasses[color as keyof typeof colorClasses] || "text-primary"}`}>
        {value}
      </p>
    </div>
  );
}
