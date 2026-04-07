import { motion } from "framer-motion";
import { Shield, ShieldOff, Loader2, Clock, RefreshCcw, KeyRound } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { ServiceConnection } from "@/lib/store";
import { Button } from "@/components/ui/button";

interface ServiceCardProps {
  service: ServiceConnection;
  onConnect: () => void;
  onRevoke: () => void;
}

export default function ServiceCard({ service, onConnect, onRevoke }: ServiceCardProps) {
  const isConnected = service.status === "connected";
  const isConnecting = service.status === "connecting";
  const healthLabel =
    service.healthStatus === "connected"
      ? "Live"
      : service.healthStatus === "expired"
        ? "Expired"
        : "Revoked";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border p-5 transition-all ${
        isConnected
          ? "border-primary/30 vault-gradient glow-green-sm"
          : "border-border bg-card hover:border-muted-foreground/20"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{service.icon}</span>
          <div>
            <h3 className="font-semibold text-foreground">{service.name}</h3>
            <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
              {isConnected ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-primary animate-pulse-glow" />
                  <span className="text-xs text-primary font-mono">Connected</span>
                </>
              ) : isConnecting ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin text-warning" />
                  <span className="text-xs text-warning font-mono">Authenticating...</span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-mono">Disconnected</span>
                </>
              )}
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono">
                {healthLabel}
              </span>
            </div>
          </div>
        </div>

        {isConnected ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onRevoke}
            className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <ShieldOff className="mr-1.5 h-3.5 w-3.5" />
            Revoke
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={onConnect}
            disabled={isConnecting}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isConnecting ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Shield className="mr-1.5 h-3.5 w-3.5" />
            )}
            Connect
          </Button>
        )}
      </div>

      {isConnected && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-4 border-t border-border pt-4"
        >
          <div className="mb-3 flex flex-wrap gap-1.5">
            {service.grantedScopes.map((scope) => (
              <span
                key={scope}
                className="rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary font-mono"
              >
                {scope}
              </span>
            ))}
          </div>

          {service.lastUsed && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              Last used {formatDistanceToNow(service.lastUsed, { addSuffix: true })}
            </div>
          )}

          {service.lastRefreshed && (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <RefreshCcw className="h-3 w-3" />
              Vault checked {formatDistanceToNow(service.lastRefreshed, { addSuffix: true })}
            </div>
          )}

          {service.connectedAt && (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Shield className="h-3 w-3" />
              Connected {formatDistanceToNow(service.connectedAt, { addSuffix: true })}
            </div>
          )}

          {service.auth0Connection && (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
              <KeyRound className="h-3 w-3" />
              Auth0 connection {service.auth0Connection}
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
