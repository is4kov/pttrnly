import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('the app shell loads', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: 'pttrnly' })).toBeVisible();
});

test('the app shell has no detectable accessibility violations', async ({ page }) => {
  await page.goto('/');

  const results = await new AxeBuilder({ page }).analyze();

  expect(results.violations).toEqual([]);
});
