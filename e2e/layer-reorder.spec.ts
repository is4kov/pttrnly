import { expect, test, type Page } from '@playwright/test';
import { previewImage } from './support';

/**
 * Drag reordering is pointer-only behaviour, so jsdom cannot see any of it:
 * no layout, no pointer capture, no hit testing. The reducer is unit-tested;
 * everything between the finger and the reducer lives here.
 */

// Scoped by test id rather than the listitem role: the preset gallery renders
// its own list, so `getByRole('listitem')` is not just the layer stack.
const rows = (page: Page) => page.getByTestId('layer-row');
const handles = (page: Page) => page.getByTestId('drag-handle');

/**
 * Layer names, top of the stack first.
 *
 * Read from the Select buttons rather than row text: a row's innerText begins
 * with the drag handle's glyph, so slicing it yields '⠿ Cyan glow'. Comparing
 * permutations of that still passes, which is exactly why it went unnoticed —
 * the values were wrong but consistently so.
 */
async function layerOrder(page: Page): Promise<string[]> {
  const labels = await page
    .getByRole('button', { name: /^Select / })
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label') ?? ''));
  return labels.map((label) => label.replace(/^Select /, ''));
}

async function boxOf(page: Page, testId: string, index: number) {
  const box = await page.getByTestId(testId).nth(index).boundingBox();
  expect(box, `${testId} #${String(index)} has no layout`).not.toBeNull();
  if (!box) throw new Error('no layout');
  return box;
}

/**
 * Drags the row at `from` onto the row at `to`.
 *
 * Moves by the distance between the two rows' centres rather than to an
 * absolute position. That is the model the hook itself uses — a row takes a
 * slot once its centre passes that slot's midpoint — so the gesture cannot
 * drift from it. Aiming at an absolute point derived from the handle broke as
 * soon as rows wrapped: the handle sits on the row's first line, not at its
 * centre, and the offset silently ate the margin.
 *
 * Boxes are measured before the gesture starts. Once the drag is live the rows
 * are translating, so anything measured mid-drag reports where a row has moved
 * to rather than where it belongs.
 */
async function dragRow(page: Page, from: number, to: number) {
  await handles(page).nth(from).scrollIntoViewIfNeeded();

  const handle = await boxOf(page, 'drag-handle', from);
  const source = await boxOf(page, 'layer-row', from);
  const target = await boxOf(page, 'layer-row', to);

  const centreOf = (box: { y: number; height: number }) => box.y + box.height / 2;
  // Clear the midpoint rather than landing exactly on it.
  const overshoot = to > from ? 8 : -8;
  const travel = centreOf(target) - centreOf(source) + overshoot;

  const x = handle.x + handle.width / 2;
  const grabY = handle.y + handle.height / 2;

  await page.mouse.move(x, grabY);
  await page.mouse.down();
  await page.mouse.move(x, grabY + travel, { steps: 15 });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(rows(page)).toHaveCount(3);
});

test('dragging a layer down the stack reorders it', async ({ page }) => {
  const before = await layerOrder(page);

  await dragRow(page, 0, 2);
  await page.mouse.up();

  const [first, second, third] = before;
  await expect.poll(() => layerOrder(page)).toEqual([second ?? '', third ?? '', first ?? '']);
});

test('dragging a layer up the stack reorders it', async ({ page }) => {
  const before = await layerOrder(page);

  await dragRow(page, 2, 0);
  await page.mouse.up();

  const [first, second, third] = before;
  await expect.poll(() => layerOrder(page)).toEqual([third ?? '', first ?? '', second ?? '']);
});

test('reordering changes the generated CSS, not just the list', async ({ page }) => {
  const before = await previewImage(page);

  await dragRow(page, 0, 2);
  await page.mouse.up();

  // The list order is the CSS order — if these can drift apart the output
  // stops being trustworthy, which is the whole product.
  await expect.poll(() => previewImage(page)).not.toBe(before);
});

test('Escape abandons a drag and leaves the stack alone', async ({ page }) => {
  const before = await layerOrder(page);

  await dragRow(page, 0, 2);
  await page.keyboard.press('Escape');
  await page.mouse.up();

  expect(await layerOrder(page)).toEqual(before);
});

test('the handle stays out of the keyboard and accessibility paths', async ({ page }) => {
  // Reordering by keyboard goes through the move buttons; a tab stop that does
  // nothing on Enter would be worse than no tab stop at all.
  await expect(handles(page).first()).toHaveAttribute('aria-hidden', 'true');
  await expect(
    rows(page)
      .first()
      .getByRole('button', { name: /^Move .* down$/ }),
  ).toBeVisible();
});

test('the handle is touch-sized and opts out of page scrolling', async ({ page }) => {
  const box = await boxOf(page, 'drag-handle', 0);

  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);
  await expect(handles(page).first()).toHaveCSS('touch-action', 'none');
});
