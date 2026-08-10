import { expect, test, type Page } from '@playwright/test';
import { previewImage } from './support';

/**
 * The rail and the editor panel are meant to read as one shape — the selected
 * row is the tab, the panel is its content. jsdom evaluates no layout and no
 * width media queries, so the geometry that makes that true is only checkable
 * here.
 */

const preview = (page: Page) => page.getByRole('img', { name: 'Pattern preview' });
/*
  The frame, not the surface inside it: role="img" sits on the inner element,
  which is 2px narrower than its container because of the frame's border.
  Measuring that against a full-width row compares the wrong two things.
*/
const previewFrame = (page: Page) => page.getByTestId('preview-frame');
const rows = (page: Page) => page.getByTestId('layer-row');
// The panel has no visible heading; it is named after the layer it is editing.
const editor = (page: Page) => page.getByRole('region', { name: /^Options for / });
const dialog = (page: Page) => page.getByRole('dialog');
const rail = (page: Page) => page.getByRole('region', { name: 'Layers' });

/*
  Names come from the Select buttons, not from row text. A row's innerText
  starts with the drag handle's glyph, so splitting it yields '⠿ Cyan glow'
  rather than a name — which then matches no accessible label at all.
*/
async function layerNames(page: Page): Promise<string[]> {
  const labels = await page
    .getByRole('button', { name: /^Select / })
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label') ?? ''));
  return labels.map((label) => label.replace(/^Select /, ''));
}

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
  const frame = await boxOf(page, previewFrame(page));
  const firstRow = await boxOf(page, rows(page).first());

  // Equal, not wider, once the rail itself is full width on a narrow screen.
  expect(frame.width).toBeGreaterThanOrEqual(firstRow.width);
  expect(frame.y + frame.height).toBeLessThanOrEqual(firstRow.y);
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
  const names = await layerNames(page);
  const second = names[1] ?? '';
  expect(second).not.toBe('');

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

test('the visibility switch is touch-sized and changes what is painted', async ({ page }) => {
  const toggle = page.getByRole('switch').first();
  const box = await boxOf(page, toggle);
  const before = await previewImage(page);

  expect(box.height).toBeGreaterThanOrEqual(44);

  await toggle.click();

  await expect(toggle).not.toBeChecked();
  // The state has to reach the output, not just the control.
  await expect.poll(() => previewImage(page)).not.toBe(before);
});

test.describe('the pinned preview', () => {
  test('the preview pins to the top instead of scrolling away', async ({ page }) => {
    const before = await boxOf(page, preview(page));

    await page.mouse.wheel(0, 1200);
    // Sticky offers no event to await, so settle the scroll first.
    await page.waitForFunction(() => window.scrollY > 200);

    const after = await boxOf(page, preview(page));

    /*
      A sticky element starts wherever the flow puts it — here below the header
      — and travels up until it pins. So the assertion is not that it never
      moved, but that it stopped at the top and stayed on screen.
    */
    expect(after.y).toBeLessThan(before.y);
    expect(after.y).toBeLessThanOrEqual(24);
    await expect(preview(page)).toBeInViewport();
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
    const before = await boxOf(page, rail(page));

    await page.mouse.wheel(0, 1200);
    await page.waitForFunction(() => window.scrollY > 200);

    const after = await boxOf(page, rail(page));
    const pinnedPreview = await boxOf(page, preview(page));

    // Comes to rest just under the pinned preview rather than scrolling away,
    // so the stack stays reachable however deep into the options you are.
    expect(after.y).toBeLessThan(before.y);
    expect(after.y).toBeGreaterThanOrEqual(pinnedPreview.y + pinnedPreview.height - 8);
    await expect(rail(page)).toBeInViewport();
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
