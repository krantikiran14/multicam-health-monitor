import { Pool } from 'pg';
import { config } from '../config';

/**
 * A single shared connection pool for the whole process. `pg` manages a small
 * set of reusable connections; we never open connections by hand.
 */
export const pool = new Pool({ connectionString: config.databaseUrl });

/** Thin helper so callers write `query(sql, params)` instead of `pool.query`. */
export function query<T extends import('pg').QueryResultRow = never>(
  text: string,
  params?: unknown[],
) {
  return pool.query<T>(text, params as never);
}
