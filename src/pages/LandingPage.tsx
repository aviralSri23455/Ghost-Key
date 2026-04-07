import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  Lock,
  Unlock,
  Eye,
  Zap,
  ArrowRight,
  Activity,
  Terminal,
  Smartphone,
  KeyRound,
  Check,
  X,
  Github,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const FLOW_STEPS = [
  { icon: Terminal, label: "Agent calls POST /agent/act", color: "text-accent", delay: 0 },
  { icon: Shield, label: "GhostKey intercepts — zero tokens in payload", color: "text-primary", delay: 0.15 },
  { icon: KeyRound, label: "Token fetched from Auth0 Vault", color: "text-primary", delay: 0.3 },
  { icon: Zap, label: "API called → token stripped → result returned", color: "text-warning", delay: 0.45 },
  { icon: Activity, label: "Audit entry logged with token hash", color: "text-accent", delay: 0.6 },
];

const FEATURES = [
  {
    icon: Lock,
    title: "Token Vault Isolation",
    description: "OAuth tokens never leave Auth0's encrypted vault. The AI agent sees zero credentials — ever.",
    gradient: "from-emerald-500/20 to-cyan-500/20",
  },
  {
    icon: Smartphone,
    title: "CIBA Step-Up Auth",
    description: "Sensitive actions trigger a push notification. Approve or deny from your device in real-time.",
    gradient: "from-amber-500/20 to-orange-500/20",
  },
  {
    icon: ShieldOff,
    title: "Instant Revocation",
    description: "One click removes vault access. The next agent call gets 403 CONSENT_REQUIRED. Trust deleted instantly.",
    gradient: "from-red-500/20 to-pink-500/20",
  },
  {
    icon: Eye,
    title: "Consent Visualiser",
    description: "See every scope, toggle any action between direct execution and step-up approval. Full transparency.",
    gradient: "from-blue-500/20 to-indigo-500/20",
  },
  {
    icon: Activity,
    title: "Real-Time Audit Trail",
    description: "Every connect, revoke, execute, and policy change — timestamped with token hashes, never full tokens.",
    gradient: "from-purple-500/20 to-violet-500/20",
  },
  {
    icon: Terminal,
    title: "AI Agent Bridge",
    description: "Built-in chat with streaming AI. The agent proposes actions, GhostKey enforces policy before execution.",
    gradient: "from-cyan-500/20 to-teal-500/20",
  },
];

function ParticleGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, hsl(152 80% 48%) 1px, transparent 0)`,
          backgroundSize: "40px 40px",
        }}
      />
      <motion.div
        className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full"
        style={{
          background: "radial-gradient(circle, hsl(152 80% 48% / 0.06) 0%, transparent 70%)",
        }}
        animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full"
        style={{
          background: "radial-gradient(circle, hsl(180 70% 45% / 0.05) 0%, transparent 70%)",
        }}
        animate={{ x: [0, -25, 0], y: [0, 15, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-1/2 right-1/3 w-64 h-64 rounded-full"
        style={{
          background: "radial-gradient(circle, hsl(38 92% 55% / 0.04) 0%, transparent 70%)",
        }}
        animate={{ x: [0, 20, 0], y: [0, 25, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

function TerminalDemo() {
  const [step, setStep] = useState(0);
  const lines = [
    { type: "comment", text: "# OpenClaw sends tool-call to GhostKey" },
    { type: "command", text: '$ curl -X POST /agent/act -d \'{"service":"gmail","action":"send_email","params":{"to":"team@co.dev"}}\'' },
    { type: "output", text: "→ GhostKey: credential scan... CLEAN ✓" },
    { type: "output", text: "→ GhostKey: getTokenFromVault('gmail') ... fetched ✓" },
    { type: "output", text: "→ GhostKey: Bearer token injected → Gmail API called" },
    { type: "output", text: "→ GhostKey: token STRIPPED from response" },
    { type: "success", text: '← {"status":"success","token":"NEVER_INCLUDED","result":{"messageId":"18f3..."}}' },
    { type: "audit", text: "📋 Audit: send_email · gmail · 0x3fa8b2c1 · success" },
  ];

  useEffect(() => {
    if (step >= lines.length) {
      const resetTimer = setTimeout(() => setStep(0), 3000);
      return () => clearTimeout(resetTimer);
    }
    const timer = setTimeout(() => setStep((s) => s + 1), 800);
    return () => clearTimeout(timer);
  }, [step, lines.length]);

  return (
    <div className="rounded-xl border border-border bg-[hsl(220,20%,3%)] p-4 font-mono text-xs overflow-hidden">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-border">
        <div className="flex gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500/70" />
          <span className="w-3 h-3 rounded-full bg-yellow-500/70" />
          <span className="w-3 h-3 rounded-full bg-green-500/70" />
        </div>
        <span className="text-muted-foreground text-[10px]">ghostkey-vault — bash</span>
      </div>
      <div className="space-y-1 min-h-[200px]">
        <AnimatePresence>
          {lines.slice(0, step).map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className={
                line.type === "comment" ? "text-muted-foreground/50" :
                line.type === "command" ? "text-accent" :
                line.type === "success" ? "text-primary" :
                line.type === "audit" ? "text-warning" :
                "text-foreground/70"
              }
            >
              {line.text}
            </motion.div>
          ))}
        </AnimatePresence>
        {step < lines.length && (
          <motion.span
            className="inline-block w-2 h-4 bg-primary"
            animate={{ opacity: [1, 0] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          />
        )}
      </div>
    </div>
  );
}

function CIBADemo() {
  const [phase, setPhase] = useState<"idle" | "pushed" | "approved" | "denied">("idle");

  useEffect(() => {
    const cycle = setInterval(() => {
      setPhase((p) => {
        if (p === "idle") return "pushed";
        if (p === "pushed") return Math.random() > 0.3 ? "approved" : "denied";
        return "idle";
      });
    }, 2500);
    return () => clearInterval(cycle);
  }, []);

  return (
    <div className="rounded-xl border border-warning/20 bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Smartphone className="w-4 h-4 text-warning" />
        <span className="text-xs font-mono text-warning">CIBA Push Notification</span>
      </div>
      <AnimatePresence mode="wait">
        {phase === "idle" && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="text-xs text-muted-foreground py-6 text-center"
          >
            Waiting for sensitive action...
          </motion.div>
        )}
        {phase === "pushed" && (
          <motion.div key="pushed" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
            className="bg-background rounded-lg p-3 border border-border"
          >
            <p className="text-sm text-foreground mb-1 font-medium">🔐 GhostKey Step-Up</p>
            <p className="text-xs text-muted-foreground mb-3">send_mass_email → 500 recipients — $5K invoice</p>
            <div className="flex gap-2">
              <div className="flex-1 py-1.5 rounded-md bg-primary/20 text-primary text-xs text-center font-medium flex items-center justify-center gap-1">
                <Check className="w-3 h-3" /> Approve
              </div>
              <div className="flex-1 py-1.5 rounded-md bg-destructive/20 text-destructive text-xs text-center font-medium flex items-center justify-center gap-1">
                <X className="w-3 h-3" /> Deny
              </div>
            </div>
          </motion.div>
        )}
        {phase === "approved" && (
          <motion.div key="approved" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 py-6 justify-center text-primary"
          >
            <ShieldCheck className="w-5 h-5" />
            <span className="text-sm font-mono font-semibold">Approved — Executing via Vault</span>
          </motion.div>
        )}
        {phase === "denied" && (
          <motion.div key="denied" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 py-6 justify-center text-destructive"
          >
            <ShieldOff className="w-5 h-5" />
            <span className="text-sm font-mono font-semibold">Denied — 403 Returned</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <ParticleGrid />

      {/* Nav */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center glow-green-sm">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <span className="text-lg font-semibold font-mono tracking-tight">GhostKey</span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Github className="w-5 h-5" />
          </a>
          <Button
            onClick={() => navigate("/login")}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
          >
            Open Dashboard
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-16 pb-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="flex items-center gap-2 mb-6">
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-mono border border-primary/20">
                  Auth0 Token Vault + CIBA
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
                <span className="text-glow">Zero-trust</span> token
                <br />
                management for
                <br />
                <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                  AI agents
                </span>
              </h1>

              <p className="text-lg text-muted-foreground max-w-lg mb-8 leading-relaxed">
                GhostKey ensures your AI agent <strong className="text-foreground">never sees an OAuth token</strong>.
                Tokens stay in Auth0's encrypted vault. Sensitive actions require
                your explicit approval. Every call is audited.
              </p>

              <div className="flex flex-wrap gap-3">
                <Button
                  size="lg"
                  onClick={() => navigate("/login")}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold glow-green"
                >
                  <Shield className="w-5 h-5 mr-2" />
                  Launch Dashboard
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="border-border hover:border-primary/30 font-medium"
                >
                  See How It Works
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <TerminalDemo />
          </motion.div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="relative z-10 border-y border-border bg-card/50">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: "0", label: "Tokens in agent payload", icon: Lock },
              { value: "3", label: "Services supported", icon: Zap },
              { value: "30s", label: "CIBA approval timeout", icon: Smartphone },
              { value: "∞", label: "Audit entries retained", icon: Activity },
            ].map((stat) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="flex flex-col items-center"
              >
                <stat.icon className="w-5 h-5 text-primary mb-2" />
                <span className="text-2xl font-bold font-mono text-primary">{stat.value}</span>
                <span className="text-xs text-muted-foreground mt-1">{stat.label}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="relative z-10 max-w-7xl mx-auto px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl font-bold mb-4">How GhostKey Works</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            The agent sends a tool-call. GhostKey enforces policy, fetches the token from Auth0 Vault,
            calls the API, strips the token, and returns the result. The agent never touches a credential.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-5 gap-4">
          {FLOW_STEPS.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: step.delay }}
              className="relative flex flex-col items-center text-center p-4"
            >
              <div className={`w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center mb-3 ${i === 0 || i === FLOW_STEPS.length - 1 ? "" : "glow-green-sm"}`}>
                <step.icon className={`w-5 h-5 ${step.color}`} />
              </div>
              <span className="text-xs text-muted-foreground font-mono mb-1">Step {i + 1}</span>
              <p className="text-sm text-foreground font-medium">{step.label}</p>
              {i < FLOW_STEPS.length - 1 && (
                <ArrowRight className="hidden md:block absolute -right-2 top-8 w-4 h-4 text-border" />
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* The Three Flows */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pb-20">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* CIBA Demo */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-warning" />
              Flow 2: Step-Up Authentication
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Sensitive actions (mass email, bulk delete) trigger CIBA. You approve or deny on your device.
            </p>
            <CIBADemo />
          </motion.div>

          {/* Revocation */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
              <Unlock className="w-5 h-5 text-destructive" />
              Flow 3: Instant Revocation
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              One click to revoke. Vault entry deleted. Next agent call → 403. Full lifecycle in the audit log.
            </p>
            <div className="rounded-xl border border-border bg-card p-4 font-mono text-xs space-y-2">
              <div className="flex items-center gap-2 text-foreground">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span>gmail: <span className="text-primary">connected</span> — send_email, read_inbox</span>
              </div>
              <motion.div
                className="flex items-center gap-2 text-foreground"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <ShieldOff className="w-4 h-4 text-destructive" />
                <span>gmail: <span className="text-destructive">revoked</span> — CONSENT_REQUIRED</span>
              </motion.div>
              <div className="pt-2 border-t border-border text-warning">
                📋 Audit: revoke_token · gmail · 0x9e2f · revoked
              </div>
              <div className="text-destructive">
                📋 Audit: send_email · gmail · error · CONSENT_REQUIRED
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl font-bold mb-4">Built for Trust & Governance</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Every feature exists to answer one question: should this AI agent be allowed to do this right now?
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className={`rounded-xl border border-border p-5 bg-gradient-to-br ${feature.gradient} hover:border-primary/20 transition-all group`}
            >
              <feature.icon className="w-8 h-8 text-primary mb-3 group-hover:scale-110 transition-transform" />
              <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Tech Stack */}
      <section className="relative z-10 border-t border-border bg-card/30">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <h2 className="text-2xl font-bold mb-8 text-center">Tech Stack</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {[
              { name: "React + Vite", desc: "Frontend" },
              { name: "Supabase", desc: "Backend + Realtime" },
              { name: "Auth0 Token Vault", desc: "Secure Tokens" },
              { name: "Tailwind CSS", desc: "Styling" },
            ].map((tech) => (
              <div key={tech.name} className="rounded-xl border border-border p-4">
                <p className="font-semibold text-foreground font-mono text-sm">{tech.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{tech.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center glow-green mb-6">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-3xl font-bold mb-4">Ready to see it in action?</h2>
          <p className="text-muted-foreground max-w-lg mx-auto mb-8">
            Connect a service, trigger a sensitive action, see the CIBA push, revoke access — all in under 60 seconds.
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/login")}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold glow-green"
          >
            <Shield className="w-5 h-5 mr-2" />
            Launch GhostKey Dashboard
          </Button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm font-mono text-muted-foreground">GhostKey</span>
            <span className="text-xs text-muted-foreground">· Auth0 Token Vault Demo</span>
          </div>
          <p className="text-xs text-muted-foreground font-mono">
            Secure AI agent actions powered by Auth0
          </p>
        </div>
      </footer>
    </div>
  );
}
