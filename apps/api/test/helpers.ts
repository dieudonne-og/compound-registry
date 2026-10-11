import { buildApp, type App } from '../src/app';
import { createDb } from '../src/db/client';
import { loadConfig, type Config } from '../src/shared/config';
import type { InjectOptions } from 'fastify';
import type { SessionUser } from '@cr/contracts';

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

export type Session = { cookies: string; csrf: string; user: SessionUser };
export type RoleName = 'admin' | 'supervisor' | 'operator' | 'auditor';

export function cookieHeader(setCookie: string | string[] | undefined): string {
  return ([] as string[])
    .concat(setCookie ?? [])
    .map((c) => c.split(';')[0])
    .join('; ');
}

export async function login(app: App, role: RoleName): Promise<Session> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email: `${role}@example.com`, password: process.env.SEED_PASSWORD ?? 'Demo!2026' },
    remoteAddress: `10.0.0.${Math.floor(Math.random() * 250) + 1}`,
  });
  if (res.statusCode !== 200) throw new Error(`login failed: ${res.body}`);
  const cookies = cookieHeader(res.headers['set-cookie']);
  const csrf = /csrf_token=([^;]+)/.exec(cookies)![1]!;
  return { cookies, csrf, user: res.json().user };
}

export function request(app: App, session: Session, opts: InjectOptions) {
  return app.inject({
    ...opts,
    headers: { ...opts.headers, cookie: session.cookies, 'x-csrf-token': session.csrf },
  });
}
