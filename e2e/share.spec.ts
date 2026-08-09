import { expect, test } from '@playwright/test';
import { openCss, previewImage } from './support';

test('the URL carries the pattern and survives a reload', async ({ page }) => {
  await page.goto('/');

  // Sync is debounced, so wait for the hash rather than racing it.
  await page.waitForURL(/#p=/);

  const shared = page.url();
  // Compare what the browser painted rather than the output string: it proves
  // the round trip survived as renderable CSS, not merely as equal text.
  const before = await previewImage(page);

  await page.goto(shared);

  await expect.poll(() => previewImage(page)).toBe(before);
});

test('an invalid link says so and does not blank the canvas', async ({ page }) => {
  await page.goto('/#p=obviously-not-a-real-payload');

  await expect(page.getByText(/invalid or corrupted/)).toBeVisible();
  await expect(page.getByRole('img', { name: 'Pattern preview' })).toBeVisible();
});

test('copying CSS puts the generated string on the clipboard', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');

  await openCss(page);
  await page.getByRole('button', { name: 'Copy CSS' }).click();

  // The app has several live regions, so `getByRole('status')` is ambiguous
  // under strict mode. Assert on the announcement text a user would hear.
  await expect(page.getByText('Copied to clipboard')).toBeVisible();

  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain('background-color:');
});
