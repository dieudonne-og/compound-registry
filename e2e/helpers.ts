import { expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

export const FIXTURES = fileURLToPath(new URL('../apps/api/test/fixtures/reports/', import.meta.url));

export async function signIn(page: Page, role: 'admin' | 'supervisor' | 'operator' | 'auditor') {
  // Seeded users have not taken the guided tour yet; mark it seen so it does not cover the screens under test.
  await page.addInitScript(() => localStorage.setItem('tour-seen-v1', '1'));
  await page.goto('/login');
  await page.getByLabel('Email').fill(`${role}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill('Demo!2026');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    /Good (morning|afternoon|evening)|Bonjour|Bonsoir/,
  );
}

export const tourDialog = (page: Page) => page.getByRole('dialog').filter({ hasText: /Welcome|Bienvenue/ });

/** Closes the guided tour if it opens; Escape is retried because it is ignored while the tour is still starting. */
export async function closeTour(page: Page) {
  const tour = tourDialog(page);
  if (
    !(await tour.waitFor({ timeout: 2500 }).then(
      () => true,
      () => false,
    ))
  )
    return;
  await expect(async () => {
    await page.keyboard.press('Escape');
    await expect(tour).toHaveCount(0, { timeout: 500 });
  }).toPass({ timeout: 5000 });
}

export const db = () =>
  mysql.createConnection(
    process.env.E2E_DATABASE_URL ?? 'mysql://cr:cr_dev_password@127.0.0.1:3306/compound_registry_e2e',
  );
