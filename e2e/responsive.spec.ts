import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test('main screens work on a phone without horizontal scrolling', async ({ page }) => {
  await signIn(page, 'operator');
  for (const path of ['/', '/production', '/production/new', '/compounds', '/compounds/upload']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
  await page.getByRole('button', { name: 'Open navigation' }).click();
  await page.getByRole('link', { name: 'Production records' }).click();
  await expect(page).toHaveURL(/\/production$/);
});
