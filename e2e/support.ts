import type { Locator, Page } from '@playwright/test';

/** The generated CSS lives behind a dialog now. */
export const cssOutput = (page: Page): Locator =>
  page.getByRole('textbox', { name: 'Generated CSS' });

export async function openCss(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Show CSS' }).click();
  await cssOutput(page).waitFor();
}

/**
 * What the browser actually painted. A stronger assertion than comparing the
 * output string: it only passes if the CSS we generated survives a real
 * parser, which is precisely what jsdom cannot tell us.
 */
export function previewImage(page: Page): Promise<string> {
  return page
    .getByRole('img', { name: 'Pattern preview' })
    .evaluate((element) => getComputedStyle(element).backgroundImage);
}
