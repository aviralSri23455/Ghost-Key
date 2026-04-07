import { motion } from "framer-motion";
import { Shield, ShieldAlert, ToggleLeft, ToggleRight } from "lucide-react";
import type { ServiceConnection, SensitiveActions } from "@/lib/store";

const allActions: Record<string, { action: string; label: string; description: string }[]> = {
  google_calendar: [
    { action: "create_event", label: "Create Event", description: "Create new calendar events" },
    { action: "read_events", label: "Read Events", description: "View calendar events" },
    { action: "delete_all_events", label: "Delete All Events", description: "Bulk delete calendar events" },
    { action: "share_calendar_externally", label: "Share Calendar", description: "Share calendar with external users" },
  ],
  gmail: [
    { action: "read_inbox", label: "Read Inbox", description: "Read email messages" },
    { action: "send_email", label: "Send Email", description: "Send individual emails" },
    { action: "send_mass_email", label: "Send Mass Email", description: "Send to multiple recipients" },
    { action: "delete_thread", label: "Delete Thread", description: "Permanently delete email threads" },
    { action: "send_with_attachment_over_5mb", label: "Large Attachments", description: "Send attachments over 5MB" },
  ],
  slack: [
    { action: "read_channels", label: "Read Channels", description: "View channel messages" },
    { action: "send_message", label: "Send Message", description: "Send to specific channels" },
    { action: "post_to_public_channel", label: "Post Public", description: "Post to public channels" },
    { action: "send_dm_to_all_members", label: "Mass DM", description: "DM all workspace members" },
  ],
};

interface ConsentVisualiserProps {
  services: ServiceConnection[];
  sensitiveActions: SensitiveActions;
  onToggle: (service: string, action: string) => void;
}

export default function ConsentVisualiser({ services, sensitiveActions, onToggle }: ConsentVisualiserProps) {
  return (
    <div className="space-y-6">
      {services.map((service) => {
        const actions = allActions[service.id] || [];
        const isConnected = service.status === "connected";

        return (
          <motion.div
            key={service.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-xl border p-5 ${
              isConnected ? "border-primary/20 bg-card" : "border-border bg-card opacity-60"
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xl">{service.icon}</span>
              <div>
                <h3 className="font-semibold text-foreground">{service.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {isConnected
                    ? `${service.grantedScopes.length} scopes granted`
                    : "Not connected"}
                </p>
              </div>
            </div>

            {isConnected && (
              <div className="space-y-1">
                {actions.map((item) => {
                  const isSensitive = sensitiveActions[service.id]?.includes(item.action) ?? false;

                  return (
                    <div
                      key={item.action}
                      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        {isSensitive ? (
                          <ShieldAlert className="w-3.5 h-3.5 text-warning" />
                        ) : (
                          <Shield className="w-3.5 h-3.5 text-primary/50" />
                        )}
                        <div>
                          <span className="text-sm text-foreground">{item.label}</span>
                          <p className="text-[11px] text-muted-foreground">{item.description}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => onToggle(service.id, item.action)}
                        className="flex items-center gap-1.5 group"
                      >
                        {isSensitive ? (
                          <>
                            <span className="text-[10px] font-mono text-warning">CIBA</span>
                            <ToggleRight className="w-5 h-5 text-warning" />
                          </>
                        ) : (
                          <>
                            <span className="text-[10px] font-mono text-muted-foreground group-hover:text-foreground">
                              Direct
                            </span>
                            <ToggleLeft className="w-5 h-5 text-muted-foreground group-hover:text-foreground" />
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
