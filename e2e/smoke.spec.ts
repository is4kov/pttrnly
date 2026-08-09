import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { cssOutput, openCss, previewImage } from './support';

test('the app loads with the starter pattern', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: 'pttrnly' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Pattern preview' })).toBeVisible();
  await expect(page.getByRole('listitem')).not.toHaveCount(0);
});

test('the preview actually renders the generated CSS', async ({ page }) => {
  await page.goto('/');

  // This is the assertion jsdom cannot make: it drops modern gradient syntax,
  // so only a real browser can confirm the output is valid CSS at all.
  const image = await previewImage(page);

  expect(image).toContain('gradient');
  expect(image).not.toBe('none');
});

test('oklch interpolation survives a real CSS parser', async ({ page }) => {
  await page.goto('/');

  await openCss(page);
  expect(await cssOutput(page).inputValue()).toContain('in oklch');
  await page.keyboard.press('Escape');

  const image = await previewImage(page);

  // A browser drops the whole declaration if the hint is misplaced — which is
  // exactly the bug that shipped in PTRN-3 and was only caught by eye.
  expect(image).toContain('gradient');
});

test('has no detectable accessibility violations', async ({ page }) => {
  await page.goto('/');

  const results = await new AxeBuilder({ page }).analyze();

  // Asserting on the raw violations prints ~120 lines of node detail per rule,
  // which buries the actual finding. Fail on a readable summary instead.
  expect(
    results.violations.map((violation) => `${violation.id} (${violation.impact ?? 'unknown'})`),
  ).toEqual([]);
});
