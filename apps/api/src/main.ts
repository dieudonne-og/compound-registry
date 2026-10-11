import { buildApp } from './app';
import { createDb } from './db/client';
import { runMigrations } from './db/migrate';
import { seed } from './db/seed';
import { loadConfig } from './shared/config';
import { createCompoundService } from './modules/compounds/compounds.service';
import { startMaintenance } from './modules/compounds/cleanup';
import { purgeIdempotencyKeys } from './modules/production/idempotency';

const config = loadConfig();
const { db, pool } = createDb(config.DATABASE_URL);
await runMigrations(pool);
await seed({ db, config }, { demo: config.NODE_ENV !== 'production' });

const app = await buildApp({ config, db, pool });
const compounds = createCompoundService({ db, storage: app.storage, config });
startMaintenance(app, [() => compounds.expirePending(), () => purgeIdempotencyKeys(db)]);

const shutdown = async () => {
  await app.close();
  await pool.end();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port: config.PORT, host: '0.0.0.0' });
