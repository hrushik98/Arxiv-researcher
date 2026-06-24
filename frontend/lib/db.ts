import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let _sql: NeonQueryFunction<false, false> | null = null;

/**
 * Lazily create the Neon client. Done lazily (not at module load) so that
 * `next build` — which imports route modules to collect page data without a
 * NEON_DB_URL present (e.g. inside Docker) — does not throw.
 */
export function getSql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    const connectionString = process.env.NEON_DB_URL;
    if (!connectionString) throw new Error("NEON_DB_URL is not set");
    _sql = neon(connectionString);
  }
  return _sql;
}
