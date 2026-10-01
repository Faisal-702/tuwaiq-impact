import "server-only";
import postgres from "postgres";
import { env } from "./env";

type Sql = ReturnType<typeof postgres>;

const globalForDb = globalThis as unknown as { __tiSql?: Sql };

function createClient(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url && env.isProduction && process.env.NEXT_PHASE !== "phase-production-build") {
    console.error("DATABASE_URL is not set — database queries will fail.");
  }
  // Connections are opened lazily on the first query, so a missing URL only
  // matters at request time (this keeps `next build` working without secrets).
  return postgres(url ?? "postgres://localhost:5432/postgres", {
    // Supabase's transaction pooler does not support prepared statements.
    prepare: false,
    max: env.isProduction ? 5 : 10,
    idle_timeout: 20,
    connect_timeout: 15,
    transform: { undefined: null },
  });
}

/** Server-only Postgres client (Supabase Postgres in production). */
export const sql: Sql = globalForDb.__tiSql ?? createClient();

if (!env.isProduction) {
  globalForDb.__tiSql = sql;
}
