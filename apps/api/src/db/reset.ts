import mysql from 'mysql2/promise';
import { createDb } from './client';
import { runMigrations } from './migrate';
import { seed } from './seed';
import { loadConfig, type Config } from '../shared/config';

export async function resetDatabase(config: Config, opts: { demo: boolean }) {
  const url = config.DATABASE_URL;
  const parsed = new URL(url);
  const name = parsed.pathname.slice(1);
  if (!/^[a-z0-9_]+$/i.test(name)) throw new Error(`Refusing to reset database "${name}"`);
  parsed.pathname = '/';
  const admin = await mysql.createConnection(parsed.toString());
  await admin.query(`DROP DATABASE IF EXISTS \`${name}\``);
  await admin.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
  await admin.end();

  const { db, pool } = createDb(url);
  await runMigrations(pool);
  await seed({ db, config }, opts);
  await pool.end();
}

if (process.argv[1]?.endsWith('reset.ts') || process.argv[1]?.endsWith('reset.js')) {
  const config = loadConfig();
  if (config.NODE_ENV === 'production') throw new Error('Refusing to reset a production database');
  await resetDatabase(config, { demo: true });
  console.log('Database reset.');
}
