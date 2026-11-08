// Apply Drizzle migrations at deploy time using only runtime deps (no drizzle-kit needed).
// Run: node scripts/migrate.mjs
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

const url = process.env.DATABASE_URL ?? "postgres://mandate:mandate@localhost:5433/mandate";
const local = /localhost|127\.0\.0\.1/.test(url);
const client = postgres(url, { max: 1, ssl: local ? false : "prefer" });
await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
await client.end();
console.log("migrations applied");
