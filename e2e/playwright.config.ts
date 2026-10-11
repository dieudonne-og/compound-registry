import { defineConfig, devices } from '@playwright/test';

const E2E_DB =
  process.env.E2E_DATABASE_URL ?? 'mysql://cr:cr_dev_password@127.0.0.1:3306/compound_registry_e2e';

export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../playwright-report' }]],
  use: { baseURL: 'http://localhost:5174', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      testIgnore: /responsive/,
    },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /responsive/ },
  ],
  webServer: [
    {
      command: 'pnpm --filter @cr/api start:e2e',
      url: 'http://localhost:3100/api/health',
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        NODE_ENV: 'test',
        PORT: '3100',
        DATABASE_URL: E2E_DB,
        LOG_LEVEL: 'warn',
        STORAGE_DIR: './storage-e2e',
        JWT_SECRET: 'e2e-jwt-secret-e2e-jwt-secret-123456',
        AUDIT_SECRET: 'e2e-audit-secret-e2e-audit-secret-1234',
        WEB_ORIGIN: 'http://localhost:5174',
      },
    },
    {
      command: 'pnpm --filter @cr/web dev',
      url: 'http://localhost:5174',
      timeout: 60_000,
      reuseExistingServer: false,
      env: { WEB_PORT: '5174', API_URL: 'http://localhost:3100', VITE_SHOW_DEMO_ACCOUNTS: 'true' },
    },
  ],
});
