import { expect, test, type Page } from '@playwright/test';
import { previewImage } from './support';

/**
 * Pointer drag cannot be covered by unit tests: jsdom has no layout and no
 * pointer capture, so overlap, focus and hit-testing are invisible to it.
 * Every bug in the stop editor so far has lived in exactly this code.
 */

const stopHandles = (page: Page) => page.getByRole('slider', { name: /^Stop \d+$/ });

async function trackBox(page: Page) {
  const track = page.getByTestId('stop-track');
  // `page.mouse` takes raw viewport coordinates and does no scrolling, so the
  // track has to be on screen before its box means anything.
  await track.scrollIntoViewIfNeeded();
  const box = await track.boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error('stop track has no layout');
  return box;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // The starter's top layer is a gradient, so the stop editor is present.
  await page
    .getByRole('button', { name: /^Select / })
    .first()
    .click();
});

test('dragging a stop to the right increases its position', async ({ page }) => {
  const handle = stopHandles(page).first();
  const box = await trackBox(page);

  await expect(handle).toHaveAttribute('aria-valuenow', '0');

  await handle.hover();
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();

  // The bug this guards: the track span used to collapse onto the dragged stop,
  // so a handle could only ever move left.
  const value = Number(await handle.getAttribute('aria-valuenow'));
  expect(value).toBeGreaterThan(10);
});

test('dragging updates the generated CSS', async ({ page }) => {
  const before = await previewImage(page);
  const box = await trackBox(page);

  await stopHandles(page).first().hover();
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();

  await expect.poll(() => previewImage(page)).not.toBe(before);
});

test('clicking the track adds a stop', async ({ page }) => {
  const before = await stopHandles(page).count();
  const box = await trackBox(page);

  // Click through the locator, not `page.mouse`: it waits for actionability and
  // scrolls first. The ramp overlays the track, so if it captured pointer events
  // this would do nothing at all — which is what it used to do.
  await page
    .getByTestId('stop-track')
    .click({ position: { x: box.width * 0.5, y: box.height / 2 } });

  await expect(stopHandles(page)).toHaveCount(before + 1);
});

test('clicking a handle focuses it, so the keyboard works straight after', async ({ page }) => {
  const handle = stopHandles(page).first();

  await handle.click();
  await expect(handle).toBeFocused();

  await page.keyboard.press('ArrowRight');
  await expect(handle).toHaveAttribute('aria-valuenow', '1');

  await page.keyboard.press('Shift+ArrowRight');
  await expect(handle).toHaveAttribute('aria-valuenow', '11');
});

test('stop handles are large enough to hit on touch', async ({ page }) => {
  const box = await stopHandles(page).first().boundingBox();

  expect(box).not.toBeNull();
  if (!box) return;

  // CLAUDE.md requires a 44px minimum target, with the visual handle smaller.
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
});

test('the drag surface opts out of touch scrolling', async ({ page }) => {
  await expect(stopHandles(page).first()).toHaveCSS('touch-action', 'none');
});
