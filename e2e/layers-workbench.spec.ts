import { expect, test, type Page } from '@playwright/test';

/**
 * The rail and the editor panel are meant to read as one shape — the selected
 * row is the tab, the panel is its content. jsdom evaluates no layout and no
 * width media queries, so the geometry that makes that true is only checkable
 * here.
 */

const preview = (page: Page) => page.getByRole('img', { name: 'Pattern preview' });
const rows = (page: Page) => page.getByTestId('layer-row');
// The panel has no visible heading; it is named after the layer it is editing.
const editor = (page: Page) => page.getByRole('region', { name: /^Options for / });
const dialog = (page: Page) => page.getByRole('dialog');

async function boxOf(page: Page, locator: ReturnType<typeof preview>) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error('no layout');
  return box;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('the preview runs the full width, above the layers', async ({ page }) => {
  const surface = await boxOf(page, preview(page));
  const firstRow = await boxOf(page, rows(page).first());

  expect(surface.width).toBeGreaterThan(firstRow.width);
  expect(surface.y + surface.height).toBeLessThanOrEqual(firstRow.y);
});

test('the preview does not swallow the fold', async ({ page }) => {
  const surface = await boxOf(page, preview(page));
  const viewport = page.viewportSize();

  // Full width at 16/10 would be ~760px tall on a desktop viewport, which puts
  // the entire editor below the fold. The height cap is what prevents that.
  expect(surface.height).toBeLessThanOrEqual((viewport?.height ?? 0) * 0.62 + 1);
});

test('nothing overflows sideways at any tested width', async ({ page }) => {
  const overflow = await page.evaluate(() => {
    const { scrollWidth, clientWidth } = document.documentElement;
    return scrollWidth - clientWidth;
  });

  expect(overflow).toBeLessThanOrEqual(0);
});

test('selecting a row drives the editor panel', async ({ page }) => {
  const names = await rows(page).allInnerTexts();
  const second = names[1]?.split('\n')[0]?.trim() ?? '';

  await page.getByRole('button', { name: `Select ${second}` }).click();

  await expect(editor(page).getByLabel('Name')).toHaveValue(second);
});

test('adding a layer goes through a dialog', async ({ page }) => {
  const before = await rows(page).count();

  await page.getByRole('button', { name: 'Add layer' }).click();
  // Scoped to the dialog: once the layer exists its row carries buttons named
  // 'Select Conic gradient' and 'Hide Conic gradient', which match too.
  await dialog(page).getByRole('button', { name: 'Conic gradient' }).click();

  await expect(rows(page)).toHaveCount(before + 1);
  await expect(dialog(page)).toBeHidden();
});

test.describe('the pinned preview', () => {
  test('the preview stays put while the editor scrolls under it', async ({ page }) => {
    const before = await boxOf(page, preview(page));

    await page.mouse.wheel(0, 1200);
    // Sticky offers no event to await, so settle the scroll first.
    await page.waitForFunction(() => window.scrollY > 200);

    const after = await boxOf(page, preview(page));

    // The whole point: it pins rather than scrolling away.
    expect(after.y).toBeGreaterThan(before.y - 8);
    expect(after.y).toBeLessThanOrEqual(before.y + 8);
  });

  test('scrolling never rearranges the layout', async ({ page }) => {
    const before = await boxOf(page, preview(page));

    await page.mouse.wheel(0, 1500);
    await page.waitForFunction(() => window.scrollY > 200);
    await page.mouse.wheel(0, -1500);
    await page.waitForFunction(() => window.scrollY === 0);

    const after = await boxOf(page, preview(page));

    // Width and height are decided by the viewport alone. If either moved, the
    // layout is responding to scroll position, which is the jolt we are avoiding.
    expect(after.width).toBe(before.width);
    expect(after.height).toBe(before.height);
    expect(after.x).toBe(before.x);
  });
});

test.describe('side by side, from md up', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 768, 'the panel stacks on small screens');

  test('the layer rail is pinned as well as the preview', async ({ page }) => {
    const before = await boxOf(page, page.getByRole('region', { name: 'Layers' }));

    await page.mouse.wheel(0, 1200);
    await page.waitForFunction(() => window.scrollY > 200);

    const after = await boxOf(page, page.getByRole('region', { name: 'Layers' }));

    // Pinned, so the stack stays reachable however deep into the options you go.
    expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(8);
  });

  test('the selected row meets the panel with no seam', async ({ page }) => {
    const selected = rows(page)
      .filter({ has: page.locator('[aria-current="true"]') })
      .first();

    const row = await boxOf(page, selected);
    const panel = await boxOf(page, editor(page));

    // Touching, not merely adjacent: any gap here and the tab illusion breaks.
    expect(Math.abs(row.x + row.width - panel.x)).toBeLessThanOrEqual(1);
    expect(row.y).toBeGreaterThanOrEqual(panel.y - 1);
  });
});
