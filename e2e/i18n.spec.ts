import { expect, test } from '@playwright/test';
import { db, signIn } from './helpers';

// The language choice is saved to the account; put it back so later tests see English.
test.afterEach(async () => {
  const conn = await db();
  await conn.query("UPDATE users SET preferences = NULL WHERE email = 'supervisor@example.com'");
  await conn.end();
});

test('switching to French translates screens, dates and server messages', async ({ page }) => {
  await signIn(page, 'supervisor');
  await page.getByRole('button', { name: /language|langue/i }).click();
  await page.getByRole('menuitemradio', { name: 'Français' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Bonjour|Bonsoir/);
  await page.goto('/production');
  await expect(page.getByRole('heading', { name: 'Enregistrements de production' })).toBeVisible();
  await expect(page.getByText(/oct\.|sept\./).first()).toBeVisible();
  await page.goto('/production/new');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Le numéro d’étiquette est obligatoire')).toBeVisible();
});
