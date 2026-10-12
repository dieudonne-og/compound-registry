import { expect, test } from '@playwright/test';
import { closeTour, db, signIn, tourDialog } from './helpers';

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

test('an administrator adds a user who must change the password at first sign-in', async ({
  page,
  browser,
}) => {
  await signIn(page, 'admin');
  await page.goto('/admin/users');
  await page.getByRole('button', { name: 'Add user' }).click();
  await page.getByLabel('Name').fill('Diane Uwimana');
  await page.getByLabel('Email').fill('diane@example.com');
  await page.getByRole('combobox', { name: 'Role' }).click();
  await page.getByRole('option', { name: 'Operator' }).click();
  await page.getByRole('button', { name: 'Create user' }).click();
  const temporary = await page.getByLabel('Temporary password').inputValue();
  expect(temporary).toHaveLength(16);

  const other = await browser.newPage();
  await other.goto('/login');
  await other.getByLabel('Email').fill('diane@example.com');
  await other.getByLabel('Password', { exact: true }).fill(temporary);
  await other.getByRole('button', { name: 'Sign in' }).click();
  await expect(other).toHaveURL(/\/change-password$/);
  await other.goto('/production/1'); // a deep link must not escape the forced change
  await expect(other).toHaveURL(/\/change-password$/);
  await other.getByLabel('Current password').fill(temporary);
  await other.getByLabel('New password', { exact: true }).fill('diane-new-passphrase');
  await other.getByLabel('Confirm new password').fill('diane-new-passphrase');
  await other.getByRole('button', { name: 'Change password' }).click();
  await expect(other).toHaveURL(/\/$/);

  // A new user is offered the guided tour once.
  await expect(tourDialog(other)).toBeVisible();
  await closeTour(other);
  await other.reload();
  await other.waitForTimeout(1500);
  await expect(tourDialog(other)).toHaveCount(0);

  await page.getByRole('button', { name: 'Done' }).click();
  await page.goto('/admin/activity');
  await expect(page.getByText('diane@example.com').first()).toBeVisible();
});
