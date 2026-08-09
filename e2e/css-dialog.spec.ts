import { expect, test, type Page } from '@playwright/test';
import { cssOutput, openCss } from './support';

/**
 * The dialog is a native <dialog> opened with `showModal()`, which is what
 * gives us the focus trap, Escape, the top layer and focus restoration. jsdom
 * implements none of that — it does not even define `showModal` — so this file
 * is the only place any of it is actually verified.
 */

const trigger = (page: Page) => page.getByRole('button', { name: 'Show CSS' });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('the CSS is behind a button, not on the page', async ({ page }) => {
  await expect(trigger(page)).toBeVisible();
  await expect(cssOutput(page)).toBeHidden();
});

test('opening shows the generated CSS', async ({ page }) => {
  await openCss(page);

  expect(await cssOutput(page).inputValue()).toContain('background-color:');
});

test('the output is read-only but still selectable', async ({ page }) => {
  await openCss(page);

  const output = cssOutput(page);
  await expect(output).toHaveAttribute('readonly', '');

  // Read-only, not disabled — a disabled control cannot be focused, which
  // would remove the manual copy path entirely.
  await output.focus();
  await expect(output).toBeFocused();
});

test('Escape closes it', async ({ page }) => {
  await openCss(page);

  await page.keyboard.press('Escape');

  await expect(cssOutput(page)).toBeHidden();
});

test('clicking the backdrop closes it', async ({ page }) => {
  await openCss(page);

  // Position 0,0 of the dialog box is padding-free chrome; click well outside.
  await page.mouse.click(5, 5);

  await expect(cssOutput(page)).toBeHidden();
});

test('closing returns focus to the button that opened it', async ({ page }) => {
  await trigger(page).click();
  await cssOutput(page).waitFor();

  await page.keyboard.press('Escape');

  // Native dialog restores focus; losing it would strand keyboard users at the
  // top of the document.
  await expect(trigger(page)).toBeFocused();
});

test('focus never reaches the page behind the dialog', async ({ page }) => {
  await openCss(page);

  const describeFocus = () =>
    page.evaluate(() => {
      const dialog = document.querySelector('dialog[open]');
      const active = document.activeElement;
      if (!(dialog instanceof HTMLElement) || !(active instanceof HTMLElement)) return 'unknown';
      if (dialog.contains(active)) return 'inside';

      /*
        Chrome parks focus on the body as it wraps past the last stop in a modal
        dialog. That is the trap holding, not focus escaping — the previous
        version of this test failed on exactly that and told us nothing useful.
      */
      if (active === document.body || active === document.documentElement) return 'wrapping';

      const label = active.getAttribute('aria-label') ?? active.textContent?.trim() ?? '';
      return `escaped to <${active.tagName.toLowerCase()}> ${label.slice(0, 40)}`;
    });

  const seen: string[] = [];
  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press('Tab');
    seen.push(await describeFocus());
  }

  expect(seen.filter((entry) => entry.startsWith('escaped'))).toEqual([]);
  // Guards the vacuous pass: a dialog with nothing focusable would otherwise
  // satisfy the assertion above.
  expect(seen).toContain('inside');
});

test('the mode and colour toggles still drive the output', async ({ page }) => {
  await openCss(page);

  expect(await cssOutput(page).inputValue()).toContain('background-image:');

  await page.getByRole('radio', { name: 'Shorthand' }).click();

  const shorthand = await cssOutput(page).inputValue();
  expect(shorthand).not.toContain('background-image:');
  expect(shorthand).toContain('background:');
});
