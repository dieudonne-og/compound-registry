import { fileURLToPath } from 'node:url';
import { createDb, type Database } from './client';
import { loadConfig, type Config } from '../shared/config';
import { seedReference } from '../modules/reference/reference.seed';
import { seedAdmin, seedUsers } from '../modules/auth/users.seed';
import { users } from './schema';
import { userSeedPlan } from './seed-plan';
import { seedProduction } from '../modules/production/production.seed';

export async function seed(ctx: { db: Database; config: Config }, opts: { demo: boolean }) {
  await seedReference(ctx.db);
  const hasUsers = (await ctx.db.select({ id: users.id }).from(users).limit(1)).length > 0;
  if (!hasUsers) {
    const plan = userSeedPlan({
      nodeEnv: ctx.config.NODE_ENV,
      demo: opts.demo,
      adminEmail: process.env.ADMIN_EMAIL,
      adminPassword: process.env.ADMIN_PASSWORD,
    });
    if (plan.kind === 'demo') await seedUsers(ctx.db, process.env.SEED_PASSWORD ?? 'Demo!2026');
    else await seedAdmin(ctx.db, plan.email, plan.password);
  }
  if (opts.demo) await seedProduction(ctx.db, ctx.config);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const config = loadConfig();
  const { db, pool } = createDb(config.DATABASE_URL);
  await seed({ db, config }, { demo: true });
  console.log('Seed complete.');
  await pool.end();
}
