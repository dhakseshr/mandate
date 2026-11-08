// Centralised, server-only environment access. Never import this from client components.
function req(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env var ${name} (see .env.example)`);
  return v;
}

export const env = {
  paypal: {
    clientId: () => req("PAYPAL_CLIENT_ID"),
    clientSecret: () => req("PAYPAL_CLIENT_SECRET"),
    sandbox: () => (process.env.PAYPAL_ENV ?? "sandbox") !== "live",
    webhookId: () => process.env.PAYPAL_WEBHOOK_ID,
  },
  ai: {
    provider: () => (process.env.AI_PROVIDER ?? "goedel") as "goedel" | "google",
  },
  channel3Key: () => process.env.CHANNEL3_API_KEY,
  databaseUrl: () => process.env.DATABASE_URL ?? "postgres://mandate:mandate@localhost:5433/mandate",
};
