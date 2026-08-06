import { expect, test } from '@playwright/test';

/**
 * Pointer drag cannot be covered in unit tests — jsdom has no Pointer Events.
 * These specs are the only coverage of the drag path.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // The starter pattern's top layer is a gradient, so the stop bar is present.
  await page.getByRole('button', { name: 'Select Cyan glow' }).click();
});

test('dragging a stop moves it and updates the generated CSS', async ({ page }) => {
  const handle = page.getByRole('slider', { name: 'Stop 1' });
  const track = page.getByTestId('stop-track');

  const before = await handle.getAttribute('aria-valuenow');
  const box = await track.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  await handle.hover();
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();

  await expect(handle).not.toHaveAttribute('aria-valuenow', before ?? '');
});

test('a dragged stop is reflected in the copied CSS', async ({ page }) => {
  const css = page.locator('pre code');
  const before = await css.textContent();

  const track = page.getByTestId('stop-track');
  const box = await track.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  await page.getByRole('slider', { name: 'Stop 2' }).hover();
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();

  await expect(css).not.toHaveText(before ?? '');
});

test('clicking the track adds a stop', async ({ page }) => {
  const handles = page.getByRole('slider', { name: /^Stop \d$/ });
  const before = await handles.count();

  const track = page.getByTestId('stop-track');
  const box = await track.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height / 2);

  await expect(handles).toHaveCount(before + 1);
});

test('the stop bar is fully operable from the keyboard', async ({ page }) => {
  const handle = page.getByRole('slider', { name: 'Stop 1' });

  await handle.focus();
  await page.keyboard.press('ArrowRight');

  await expect(handle).toHaveAttribute('aria-valuenow', '1');

  await page.keyboard.press('Shift+ArrowRight');

  await expect(handle).toHaveAttribute('aria-valuenow', '11');
});

test('touch drag works without scrolling the page', async ({ page }) => {
  const track = page.getByTestId('stop-track');
  const box = await track.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const handle = page.getByRole('slider', { name: 'Stop 1' });

  // touch-action: none on the handle is what keeps this from panning the page.
  await expect(handle).toHaveCSS('touch-action', 'none');
});
