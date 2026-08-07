import { expect, test } from '@playwright/test';

test('the URL carries the pattern and survives a reload', async ({ page }) => {
  await page.goto('/');

  // Sync is debounced, so wait for the hash rather than racing it.
  await page.waitForURL(/#p=/);

  const shared = page.url();
  const cssBefore = await page.locator('pre code').textContent();

  await page.goto(shared);

  await expect(page.locator('pre code')).toHaveText(cssBefore ?? '');
});

test('an invalid link says so and does not blank the canvas', async ({ page }) => {
  await page.goto('/#p=obviously-not-a-real-payload');

  await expect(page.getByText(/invalid or corrupted/)).toBeVisible();
  await expect(page.getByRole('img', { name: 'Pattern preview' })).toBeVisible();
});

test('copying CSS puts the generated string on the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');

  await page.getByRole('button', { name: 'Copy CSS' }).click();

  await expect(page.getByRole('status')).toHaveText('Copied to clipboard');

  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain('background-color:');
});
