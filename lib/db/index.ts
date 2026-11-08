import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

const g = globalThis as unknown as { __pg?: ReturnType<typeof postgres> };
// Reuse one pool across Next.js hot reloads.
const client =
  g.__pg ??
  postgres(env.databaseUrl(), {
    max: 5,
    // Render's internal Postgres URL may not use TLS; external URLs do. "prefer" handles both.
    ssl: /localhost|127\.0\.0\.1/.test(env.databaseUrl()) ? false : "prefer",
  });
if (process.env.NODE_ENV !== "production") g.__pg = client;

export const db = drizzle(client, { schema });
export { schema };
