import { useState } from "react";
import { Shield, LogIn, UserPlus, Loader2, Lock, ShieldCheck, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";

function GridBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, hsl(152 80% 48%) 1px, transparent 0)",
          backgroundSize: "40px 40px",
        }}
      />
      <motion.div
        className="absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 rounded-full"
        style={{
          background: "radial-gradient(circle, hsl(152 80% 48% / 0.06) 0%, transparent 70%)",
        }}
        animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute bottom-0 right-1/4 h-[300px] w-[300px] rounded-full bg-accent/5 blur-[80px]" />
    </div>
  );
}

export default function LoginPage() {
  const [loadingMode, setLoadingMode] = useState<"signin" | "signup" | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const { signIn, signUp, isAuthenticated, loading, user } = useAuth();

  const handleSignIn = async () => {
    setLoadingMode("signin");
    const { error } = await signIn();
    if (error) {
      toast.error(error);
      setLoadingMode(null);
    }
  };

  const handleSignUp = async () => {
    setLoadingMode("signup");
    const { error } = await signUp();
    if (error) {
      toast.error(error);
      setLoadingMode(null);
    }
  };

  const debugInfo = {
    domain: import.meta.env.VITE_AUTH0_DOMAIN,
    clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,
    audience: import.meta.env.VITE_AUTH0_AUDIENCE,
    isAuthenticated,
    loading,
    hasUser: !!user,
    userEmail: user?.email || 'none',
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <GridBackground />

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to home
          </Link>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 glow-green">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-mono text-2xl font-bold text-foreground">GhostKey</h1>
          <p className="mt-1 text-sm text-muted-foreground">Token Vault for AI Agents</p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <span className="rounded-md border border-accent/20 bg-accent/10 px-2 py-1 text-xs font-mono text-accent">
              Auth0 Universal Login
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4 rounded-2xl border border-border bg-card/80 p-6 backdrop-blur-sm"
        >
          <h2 className="text-lg font-semibold text-foreground">Sign in with Auth0</h2>
          <p className="text-sm text-muted-foreground">
            The dashboard now uses Auth0 Universal Login instead of Supabase Auth. Your GhostKey
            session and vault actions come from the same identity layer.
          </p>

          <Button
            type="button"
            onClick={handleSignIn}
            disabled={loadingMode !== null}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {loadingMode === "signin" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <LogIn className="mr-2 h-4 w-4" />
            )}
            Continue to Universal Login
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleSignUp}
            disabled={loadingMode !== null}
            className="w-full"
          >
            {loadingMode === "signup" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="mr-2 h-4 w-4" />
            )}
            Create account in Auth0
          </Button>

          <div className="rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
            Callback: <span className="font-mono text-foreground">{window.location.origin}</span>
          </div>

          <button
            type="button"
            onClick={() => setShowDebug(!showDebug)}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showDebug ? 'Hide' : 'Show'} Auth Debug Info
          </button>

          {showDebug && (
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs font-mono space-y-1">
              <div><span className="text-muted-foreground">Domain:</span> <span className="text-foreground">{debugInfo.domain || 'NOT SET'}</span></div>
              <div><span className="text-muted-foreground">Client ID:</span> <span className="text-foreground">{debugInfo.clientId || 'NOT SET'}</span></div>
              <div><span className="text-muted-foreground">Audience:</span> <span className="text-foreground">{debugInfo.audience || 'NOT SET'}</span></div>
              <div><span className="text-muted-foreground">Authenticated:</span> <span className={debugInfo.isAuthenticated ? 'text-green-500' : 'text-red-500'}>{String(debugInfo.isAuthenticated)}</span></div>
              <div><span className="text-muted-foreground">Loading:</span> <span className="text-foreground">{String(debugInfo.loading)}</span></div>
              <div><span className="text-muted-foreground">Has User:</span> <span className={debugInfo.hasUser ? 'text-green-500' : 'text-red-500'}>{String(debugInfo.hasUser)}</span></div>
              <div><span className="text-muted-foreground">User Email:</span> <span className="text-foreground">{debugInfo.userEmail}</span></div>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 flex items-center justify-center gap-4 font-mono text-[10px] text-muted-foreground"
        >
          <span className="flex items-center gap-1">
            <Lock className="h-3 w-3 text-primary" /> Zero token exposure
          </span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="h-3 w-3 text-primary" /> Auth0 identity layer
          </span>
        </motion.div>
      </div>
    </div>
  );
}
