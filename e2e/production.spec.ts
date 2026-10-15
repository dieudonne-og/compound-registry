import { expect, test } from '@playwright/test';
import type { RowDataPacket } from 'mysql2';
import { db, signIn } from './helpers';

async function pick(page: import('@playwright/test').Page, label: string) {
  await page.getByRole('combobox', { name: label }).click();
  await page.getByRole('option').first().click();
}

test('register, correct with a reason, verify, then detect tampering', async ({ page }) => {
  await signIn(page, 'supervisor');
  await page.goto('/production/new');

  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page.getByText('Tag number is required')).toBeVisible();

  const tag = `E2E-${Date.now().toString(36).toUpperCase()}`;
  await page.getByLabel('Tag number').fill(tag);
  await page.getByLabel('Production date').click();
  await page.getByRole('gridcell').filter({ hasText: /^1$/ }).first().click();
  await pick(page, 'Mineral type');
  await page.getByLabel('Production weight').fill('320.3');
  await pick(page, 'Company');
  await pick(page, 'Business location');
  await pick(page, 'Traceability agent');
  await page.getByLabel('Operator representative').fill('Jean Mugabo');
  await page.getByRole('button', { name: 'Register' }).dblclick();

  await expect(page.getByText(/^Registered PRD-/)).toBeVisible();
  const conn = await db();
  const [counts] = await conn.query<RowDataPacket[]>(
    'SELECT COUNT(*) AS n FROM production WHERE tag_number = ?',
    [tag],
  );
  expect(Number(counts[0]!.n)).toBe(1);

  await page.getByRole('link', { name: 'Edit' }).click();
  await page.getByLabel('Production weight').fill('318.5');
  await expect(page.getByText('This change will be recorded')).toBeVisible();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Explain why these values changed')).toBeVisible();
  await page.getByLabel('Reason for change').fill('Re-weighed at the warehouse');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('“Re-weighed at the warehouse”')).toBeVisible();
  await page.getByRole('button', { name: 'Verify integrity' }).click();
  await expect(page.getByText('History intact')).toBeVisible();

  await conn.query('UPDATE production SET weight_kg = 999 WHERE tag_number = ?', [tag]);
  await conn.end();
  await page.getByRole('button', { name: 'Verify again' }).click();
  await expect(page.getByText('Tampering detected')).toBeVisible();
});

test('auditors can read and verify but not edit', async ({ page }) => {
  await signIn(page, 'auditor');
  await page.goto('/production');
  await expect(page.getByRole('link', { name: 'Register production' })).toHaveCount(0);
  await page.getByRole('row').nth(1).click();
  await expect(page.getByRole('button', { name: 'Verify integrity' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Edit' })).toHaveCount(0);

  // Opening a write-only page by its address explains the restriction instead of showing the form.
  for (const path of ['/production/new', '/compounds/upload']) {
    await page.goto(path);
    await expect(page.getByText('Your role does not allow this page.')).toBeVisible();
  }
});
