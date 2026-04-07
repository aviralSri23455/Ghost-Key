import { useState } from "react";
import { ScrollText, Download } from "lucide-react";
import AuditLogFeed from "@/components/AuditLogFeed";
import { useGhostKey } from "@/lib/GhostKeyContext";
import { useAuth } from "@/lib/AuthContext";
import { apiUrl } from "@/lib/api";
import { Button } from "@/components/ui/button";

const serviceFilters = [
  { label: "All Services", value: "" },
  { label: "Google Calendar", value: "google_calendar" },
  { label: "Gmail", value: "gmail" },
  { label: "Slack", value: "slack" },
];

const resultFilters = [
  { label: "All Results", value: "" },
  { label: "Success", value: "success" },
  { label: "Blocked", value: "blocked" },
  { label: "Revoked", value: "revoked" },
  { label: "Step-Up ✓", value: "step_up_approved" },
  { label: "Step-Up ✕", value: "step_up_denied" },
  { label: "Error", value: "error" },
];

export default function AuditPage() {
  const { auditLog } = useGhostKey();
  const { getAccessToken } = useAuth();
  const [serviceFilter, setServiceFilter] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [exporting, setExporting] = useState(false);

  const filtered = auditLog
    .filter((entry) => !serviceFilter || entry.service === serviceFilter)
    .filter((entry) => !resultFilter || entry.result === resultFilter);

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = await getAccessToken();
      const params = new URLSearchParams();
      if (serviceFilter) params.set("service", serviceFilter);

      const res = await fetch(apiUrl(`audit/export?${params.toString()}`), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        throw new Error("Failed to export audit CSV.");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ghostkey-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-foreground">
            <ScrollText className="h-6 w-6 text-accent" />
            Real-Time Audit Log
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every API call is logged with timestamp, service, action, hashed params, and step-up outcome.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={filtered.length === 0 || exporting}
          className="border-muted-foreground/20 text-muted-foreground hover:text-foreground hover:border-accent/30 text-xs"
        >
          <Download className="mr-1.5 h-3 w-3" />
          {exporting ? "Exporting..." : "Export CSV"}
        </Button>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {serviceFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setServiceFilter(filter.value)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-mono transition-all ${
                serviceFilter === filter.value
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {resultFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setResultFilter(filter.value)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-mono transition-all ${
                resultFilter === filter.value
                  ? "border-accent/30 bg-accent/10 text-accent"
                  : "border-border bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground font-mono">
        Showing {filtered.length} of {auditLog.length} entries
        {(serviceFilter || resultFilter) && " (filtered)"}
      </p>

      <AuditLogFeed entries={filtered} />
    </div>
  );
}
