import { fileURLToPath } from 'node:url';
import { createDb, type Database } from './client';
import { loadConfig, type Config } from '../shared/config';
import { seedReference } from '../modules/reference/reference.seed';
import { seedUsers } from '../modules/auth/users.seed';
import { seedProduction } from '../modules/production/production.seed';

export async function seed(ctx: { db: Database; config: Config }, opts: { demo: boolean }) {
  await seedReference(ctx.db);
  await seedUsers(ctx.db, process.env.SEED_PASSWORD ?? 'Demo!2026');
  if (opts.demo) await seedProduction(ctx.db, ctx.config);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const config = loadConfig();
  const { db, pool } = createDb(config.DATABASE_URL);
  await seed({ db, config }, { demo: true });
  console.log('Seed complete.');
  await pool.end();
}
