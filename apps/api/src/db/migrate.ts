import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'mysql2/promise';
import { createDb } from './client';
import { loadConfig } from '../shared/config';

const MIGRATIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

export async function runMigrations(pool: Pool, dir = MIGRATIONS_DIR): Promise<string[]> {
  await pool.query(
    'CREATE TABLE IF NOT EXISTS schema_migrations (name VARCHAR(190) PRIMARY KEY, applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3))',
  );
  const [rows] = await pool.query<import('mysql2').RowDataPacket[]>('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.name as string));
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  const newlyApplied: string[] = [];

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(dir, file), 'utf8');
    for (const statement of sql
      .split(/^--> statement-breakpoint$/m)
      .map((s) => s.trim())
      .filter(Boolean)) {
      await pool.query(statement);
    }
    await pool.query('INSERT INTO schema_migrations (name) VALUES (?)', [file]);
    newlyApplied.push(file);
  }
  return newlyApplied;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { pool } = createDb(loadConfig().DATABASE_URL);
  const applied = await runMigrations(pool);
  console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Database is up to date.');
  await pool.end();
}
