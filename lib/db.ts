import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var onTheWayPgPool: Pool | undefined;
}

export function getDatabasePool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");
  if (!globalThis.onTheWayPgPool) {
    globalThis.onTheWayPgPool = new Pool({
      connectionString,
      max: Number(process.env.DB_POOL_MAX ?? 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 3_000,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
    });
  }
  return globalThis.onTheWayPgPool;
}
