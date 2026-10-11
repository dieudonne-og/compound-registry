import { buildApp, type App } from '../src/app';
import { createDb } from '../src/db/client';
import { loadConfig, type Config } from '../src/shared/config';

export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    ...loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ?? 'mysql://cr:cr_dev_password@127.0.0.1:3306/compound_registry_test',
      JWT_SECRET: 'test-jwt-secret-test-jwt-secret-1234',
      AUDIT_SECRET: 'test-audit-secret-test-audit-secret-12',
      STORAGE_DIR: './storage-test',
      LOG_LEVEL: 'silent',
      MAX_UPLOAD_MB: '2',
    }),
    ...overrides,
  };
}

export type TestApp = { app: App; close: () => Promise<void> } & ReturnType<typeof createDb>;

export async function createTestApp(overrides: Partial<Config> = {}): Promise<TestApp> {
  const config = testConfig(overrides);
  const { db, pool } = createDb(config.DATABASE_URL);
  const app = await buildApp({ config, db, pool });
  await app.ready();
  return {
    app,
    db,
    pool,
    close: async () => {
      await app.close();
      await pool.end();
    },
  };
}
