import { expect, test } from '@playwright/test';
import type { RowDataPacket } from 'mysql2';
import { db, FIXTURES, signIn } from './helpers';

test('operator uploads a scanned report, reviews it and saves it to the Compound table', async ({ page }) => {
  await signIn(page, 'operator');
  await page.getByRole('link', { name: 'Upload report' }).first().click();

  await page.getByRole('button', { name: 'Extract values' }).click();
  await expect(page.getByText('Purchase ID is required')).toBeVisible();

  await page.getByLabel('Purchase ID').fill('PO-E2E-001');
  await page.locator('input[type=file]').setInputFiles(`${FIXTURES}analysis-report-image-only.pdf`);
  await page.getByRole('button', { name: 'Extract values' }).click();

  await expect(page.getByLabel('Sn')).toHaveValue('57.5700', { timeout: 60_000 });
  for (const box of await page.getByRole('checkbox', { name: 'Looks correct' }).all()) await box.check();
  await page.getByRole('button', { name: 'Confirm and save' }).click();

  await expect(page.getByRole('heading', { name: 'PO-E2E-001' })).toBeVisible();
  const conn = await db();
  const [rows] = await conn.query<RowDataPacket[]>(
    "SELECT sn_percent, fe2o3_percent FROM `Compound` WHERE purchase_id = 'PO-E2E-001'",
  );
  const row = rows[0];
  await conn.end();
  expect(row).toEqual({ sn_percent: '57.5700', fe2o3_percent: null });
});

test('unsupported files are refused before upload', async ({ page }) => {
  await signIn(page, 'operator');
  await page.goto('/compounds/upload');
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'notes.docx', mimeType: 'application/octet-stream', buffer: Buffer.from('x') });
  await expect(page.getByRole('alert')).toContainText('PDF, JPG, JPEG or PNG');
});
