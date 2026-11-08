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
    ssl: env.databaseUrl().includes("localhost") ? false : "require",
  });
if (process.env.NODE_ENV !== "production") g.__pg = client;

export const db = drizzle(client, { schema });
export { schema };
