import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var onTheWayPgPool: Pool | undefined;
}

function getPoolMax(): number {
  const configured = Number(process.env.DB_POOL_MAX ?? 10);
  if (!Number.isInteger(configured) || configured < 1 || configured > 50) {
    return 10;
  }
  return configured;
}

export function getDatabasePool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");

  if (!globalThis.onTheWayPgPool) {
    const pool = new Pool({
      connectionString,
      application_name: "on-the-way-api",
      max: getPoolMax(),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 3_000,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
    });

    // Idle-client failures can otherwise surface as unhandled EventEmitter errors.
    // Log only a stable event name and PostgreSQL error code; never log credentials or SQL.
    pool.on("error", (error: NodeJS.ErrnoException & { code?: string }) => {
      console.error(JSON.stringify({
        event: "postgres_pool_idle_client_error",
        code: error.code ?? "unknown",
      }));
    });

    globalThis.onTheWayPgPool = pool;
  }

  return globalThis.onTheWayPgPool;
}
