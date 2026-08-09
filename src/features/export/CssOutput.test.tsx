import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CssOutput } from './CssOutput';
import { renderWithProviders } from '../../test/render';

/*
  The CSS now lives behind a dialog, so every assertion opens it first. jsdom
  has no top layer, no `inert` and no focus trap — the modal behaviour itself
  (Escape, backdrop, focus return) is asserted in e2e/css-dialog.spec.ts.
*/

const output = () => screen.getByRole('textbox', { name: 'Generated CSS' });

/** The output is a textarea now, so its content is a value rather than text. */
const cssText = (): string => {
  const element = output();
  if (!(element instanceof HTMLTextAreaElement)) throw new Error('CSS output is not a textarea');
  return element.value;
};

async function openCss(user: ReturnType<typeof userEvent.setup>) {
  renderWithProviders(<CssOutput />);
  await user.click(screen.getByRole('button', { name: 'Show CSS' }));
}

describe('CssOutput', () => {
  it('keeps the CSS behind a button until asked for', () => {
    renderWithProviders(<CssOutput />);

    expect(screen.getByRole('button', { name: 'Show CSS' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Generated CSS' })).not.toBeInTheDocument();
  });

  it('shows the generated CSS for the starter pattern', async () => {
    const user = userEvent.setup();
    await openCss(user);

    expect(cssText()).toContain('background-color:');
  });

  it('offers the output as editable-looking but read-only text', async () => {
    const user = userEvent.setup();
    await openCss(user);

    // Read-only rather than disabled: it still has to be focusable and
    // selectable so the CSS can be copied by hand.
    expect(output()).toHaveAttribute('readonly');
  });

  it('defaults to longhand and oklch', async () => {
    const user = userEvent.setup();
    await openCss(user);

    expect(screen.getByRole('radio', { name: 'Longhand' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'oklch' })).toBeChecked();
  });

  it('switches to the shorthand declaration', async () => {
    const user = userEvent.setup();
    await openCss(user);

    expect(cssText()).toContain('background-image:');

    await user.click(screen.getByRole('radio', { name: 'Shorthand' }));

    expect(cssText()).not.toContain('background-image:');
    expect(cssText()).toContain('background:');
  });

  it('re-serialises colours when the format changes', async () => {
    const user = userEvent.setup();
    await openCss(user);

    expect(cssText()).toContain('oklch(');

    await user.click(screen.getByRole('radio', { name: 'hex' }));

    expect(cssText()).not.toContain('oklch(');
    expect(cssText()).toMatch(/#[0-9a-f]{6}/);
  });

  it('copies the CSS and confirms visibly', async () => {
    // userEvent.setup() installs its own clipboard stub, so spy after it.
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');

    await openCss(user);
    await user.click(screen.getByRole('button', { name: 'Copy CSS' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Copied to clipboard');
    });
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('background-color:'));
  });

  it('tells the user when copying fails', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('denied'));

    await openCss(user);
    await user.click(screen.getByRole('button', { name: 'Copy CSS' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Copy failed');
    });
  });

  it('closes from the close button', async () => {
    const user = userEvent.setup();
    await openCss(user);

    await user.click(screen.getByRole('button', { name: 'Close generated css' }));

    expect(screen.queryByRole('textbox', { name: 'Generated CSS' })).not.toBeInTheDocument();
  });
});

describe('sharing', () => {
  it('copies a link containing the pattern', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');

    await openCss(user);
    await user.click(screen.getByRole('button', { name: 'Copy share link' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Share link copied');
    });
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('#p='));
  });
});
