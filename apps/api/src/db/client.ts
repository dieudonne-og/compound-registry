import mysql, { type Pool } from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from './schema';

export function createDb(url: string) {
  const pool = mysql.createPool({
    uri: url,
    timezone: 'Z',
    dateStrings: ['DATE'],
    connectionLimit: 10,
    supportBigNumbers: true,
  });
  // SQL defaults (CURRENT_TIMESTAMP, NOW()) must use the same clock the driver assumes: UTC.
  pool.pool.on('connection', (connection) => connection.query("SET time_zone = '+00:00'"));
  const db = drizzle(pool, { schema, mode: 'default' });
  return { db, pool };
}

export type Database = ReturnType<typeof createDb>['db'];
export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];
export type { Pool };
