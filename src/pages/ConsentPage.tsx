import { Eye } from "lucide-react";
import ConsentVisualiser from "@/components/ConsentVisualiser";
import { useGhostKey } from "@/lib/GhostKeyContext";

export default function ConsentPage() {
  const { services, sensitiveActions, toggleSensitiveAction } = useGhostKey();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
          <Eye className="w-6 h-6 text-accent" />
          Consent Scope Visualiser
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Toggle actions between direct execution and CIBA step-up authentication.
          Sensitive actions now load and save through the backend config API instead of frontend-only state.
        </p>
      </div>
      <ConsentVisualiser
        services={services}
        sensitiveActions={sensitiveActions}
        onToggle={toggleSensitiveAction}
      />
    </div>
  );
}
