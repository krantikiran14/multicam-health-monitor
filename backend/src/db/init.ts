import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pool } from './pool';
import { defaultThresholds } from '../config';
import type { Thresholds } from '../../../shared/types';

/**
 * Applies the schema (idempotent CREATE TABLE IF NOT EXISTS statements) and
 * seeds default thresholds if the table is empty. Safe to run on every boot.
 */
export async function initDb(): Promise<void> {
  const schemaPath = join(__dirname, '..', '..', '..', 'infra', 'schema.sql');
  const schemaSql = readFileSync(schemaPath, 'utf-8');
  await pool.query(schemaSql);
  await seedThresholds(defaultThresholds);
}

/** Insert default thresholds only for keys that do not already exist. */
async function seedThresholds(thresholds: Thresholds): Promise<void> {
  const entries = Object.entries(thresholds);
  for (const [key, value] of entries) {
    await pool.query(
      `INSERT INTO thresholds (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO NOTHING`,
      [key, value],
    );
  }
}
