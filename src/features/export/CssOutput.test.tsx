import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CssOutput } from './CssOutput';
import { renderWithProviders } from '../../test/render';

describe('CssOutput', () => {
  it('shows the generated CSS for the starter pattern', () => {
    renderWithProviders(<CssOutput />);

    expect(screen.getByRole('heading', { name: 'CSS' })).toBeInTheDocument();
    expect(screen.getByText(/background-color:/)).toBeInTheDocument();
  });

  it('defaults to longhand and oklch', () => {
    renderWithProviders(<CssOutput />);

    expect(screen.getByRole('radio', { name: 'Longhand' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'oklch' })).toBeChecked();
  });

  it('switches to the shorthand declaration', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CssOutput />);

    expect(screen.getByText(/background-image:/)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Shorthand' }));

    expect(screen.queryByText(/background-image:/)).not.toBeInTheDocument();
    expect(screen.getByText(/^background:/)).toBeInTheDocument();
  });

  it('re-serialises colours when the format changes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CssOutput />);

    expect(screen.getByText(/oklch\(/)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'hex' }));

    expect(screen.queryByText(/oklch\(/)).not.toBeInTheDocument();
    expect(screen.getByText(/#[0-9a-f]{6}/)).toBeInTheDocument();
  });

  it('copies the CSS and confirms visibly', async () => {
    // userEvent.setup() installs its own clipboard stub, so spy after it.
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');

    renderWithProviders(<CssOutput />);

    await user.click(screen.getByRole('button', { name: 'Copy CSS' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Copied to clipboard');
    });
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('background-color:'));
  });

  it('tells the user when copying fails', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('denied'));

    renderWithProviders(<CssOutput />);

    await user.click(screen.getByRole('button', { name: 'Copy CSS' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Copy failed');
    });
  });
});

describe('sharing', () => {
  it('copies a link containing the pattern', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');

    renderWithProviders(<CssOutput />);

    await user.click(screen.getByRole('button', { name: 'Copy share link' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Share link copied');
    });
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('#p='));
  });
});
