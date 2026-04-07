import "dotenv/config";

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.API_PORT || process.env.PORT || 4000),
  auth0: {
    domain: requireEnv("AUTH0_DOMAIN"),
    clientId: requireEnv("AUTH0_CLIENT_ID"),
    clientSecret: requireEnv("AUTH0_CLIENT_SECRET"),
    audience: requireEnv("AUTH0_AUDIENCE"),
    managementAudience:
      process.env.AUTH0_MANAGEMENT_AUDIENCE || `https://${requireEnv("AUTH0_DOMAIN")}/api/v2/`,
    callbackUrl: process.env.AUTH0_CALLBACK_URL || "http://localhost:4000/auth/callback",
    logoutUrl: process.env.AUTH0_LOGOUT_URL || "http://localhost:5173/",
    cibaMode: process.env.AUTH0_CIBA_MODE || "browser",
  },
  frontend: {
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
  },
  supabase: {
    url: requireEnv("SUPABASE_URL"),
    serviceRoleKey:
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
      requireEnv("SUPABASE_PUBLISHABLE_KEY"),
  },
  aiGatewayApiKey: process.env.AI_GATEWAY_API_KEY || process.env.LOVABLE_API_KEY || "",
  openaiApiKey: process.env.OPENAI_API_KEY || "",
};
