import { ReactNode, useState, forwardRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Shield,
  LayoutDashboard,
  Eye,
  ScrollText,
  Zap,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { useGhostKey } from "@/lib/GhostKeyContext";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/app", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/app/consent", icon: Eye, label: "Consent Scopes" },
  { to: "/app/audit", icon: ScrollText, label: "Audit Log" },
  { to: "/app/demo", icon: Zap, label: "Live Demo" },
];

const AppLayout = forwardRef<HTMLDivElement, { children: ReactNode }>(function AppLayout({ children }, ref) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { vaultHealth } = useGhostKey();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-sidebar">
        <div className="flex items-center gap-3 p-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 glow-green-sm">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-mono text-lg font-semibold tracking-tight text-foreground">GhostKey</h1>
            <p className="text-xs text-muted-foreground">Token Vault Agent</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const active = item.to === "/app"
              ? location.pathname === "/app" || location.pathname === "/app/"
              : location.pathname.startsWith(item.to);

            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${
                  active
                    ? "bg-primary/10 text-primary glow-green-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                }`}
              >
                <item.icon className="h-4 w-4" />
                <span className="font-medium">{item.label}</span>
                {active && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="ml-auto h-1.5 w-1.5 rounded-full bg-primary"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mx-3 mb-4 rounded-lg border border-border bg-muted/50 p-4">
          <p className="text-xs text-muted-foreground font-mono">Vault Status</p>
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                vaultHealth.vault === "connected" ? "bg-primary animate-pulse-glow" : "bg-warning"
              }`}
            />
            <span
              className={`text-xs font-mono ${
                vaultHealth.vault === "connected" ? "text-primary" : "text-warning"
              }`}
            >
              {vaultHealth.vault}
            </span>
          </div>
          {user && (
            <p className="mt-2 truncate text-xs text-muted-foreground font-mono" title={user.email}>
              {user.email}
            </p>
          )}
        </div>

        <div className="px-3 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={signOut}
            className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 text-xs"
          >
            <LogOut className="mr-2 h-3 w-3" />
            Sign Out
          </Button>
        </div>
      </aside>

      <div className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between border-b border-border bg-sidebar px-4 py-3 md:hidden">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-mono font-semibold text-foreground">GhostKey</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={signOut} className="text-destructive">
            <LogOut className="h-4 w-4" />
          </button>
          <button onClick={() => setMobileOpen(!mobileOpen)} className="text-foreground">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-background/95 pt-16 md:hidden">
          <nav className="space-y-2 p-4">
            {navItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm ${
                  (item.to === "/app"
                    ? location.pathname === "/app" || location.pathname === "/app/"
                    : location.pathname.startsWith(item.to))
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}

      <main className="mt-14 flex-1 overflow-auto md:mt-0" ref={ref}>
        <div className="mx-auto max-w-6xl p-4 sm:p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
});

export default AppLayout;
