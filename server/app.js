import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import agentRoutes from "./routes/agent.js";
import servicesRoutes from "./routes/services.js";
import auditRoutes from "./routes/audit.js";
import consentRoutes from "./routes/consents.js";
import aiRoutes from "./routes/ai.js";
import configRoutes from "./routes/config.js";
import { config } from "./config.js";
import { requireAuth } from "./auth0.js";

const app = express();

app.use(cors({
  origin: config.frontend.origin,
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.use("/auth", requireAuth, authRoutes);
app.use("/agent", requireAuth, agentRoutes);
app.use("/services", requireAuth, servicesRoutes);
app.use("/audit", requireAuth, auditRoutes);
app.use("/consents", requireAuth, consentRoutes);
app.use("/ai-agent", requireAuth, aiRoutes);
app.use("/config", requireAuth, configRoutes);

app.use((error, _req, res, _next) => {
  console.error(error);
  const message =
    error instanceof Error
      ? error.message
      : typeof error?.message === "string"
        ? error.message
        : typeof error?.details === "string"
          ? error.details
          : "Unknown error";
  res.status(500).json({
    error: "INTERNAL_SERVER_ERROR",
    message,
  });
});

app.listen(config.port, () => {
  console.log(`GhostKey backend listening on http://localhost:${config.port}`);
});
