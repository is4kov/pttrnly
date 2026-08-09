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

test('focus is trapped inside the dialog', async ({ page }) => {
  await openCss(page);

  const inside = async () =>
    page.evaluate(() => {
      const dialog = document.querySelector('dialog[open]');
      return dialog instanceof HTMLElement && document.activeElement instanceof HTMLElement
        ? dialog.contains(document.activeElement)
        : false;
    });

  for (let i = 0; i < 12; i += 1) {
    await page.keyboard.press('Tab');
    expect(await inside()).toBe(true);
  }
});

test('the mode and colour toggles still drive the output', async ({ page }) => {
  await openCss(page);

  expect(await cssOutput(page).inputValue()).toContain('background-image:');

  await page.getByRole('radio', { name: 'Shorthand' }).click();

  const shorthand = await cssOutput(page).inputValue();
  expect(shorthand).not.toContain('background-image:');
  expect(shorthand).toContain('background:');
});
