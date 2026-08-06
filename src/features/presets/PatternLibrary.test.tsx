import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PatternLibrary } from './PatternLibrary';
import { CanvasEditor } from '../editor/LayerEditor';
import { makeStore, patternStateFor, renderWithProviders } from '../../test/render';
import { makePattern, makeLinearLayer } from '../../test/factories';
import { presets } from './presets';
import { loadLibrary, saveLibrary } from '../persistence/storage';

function storeFor() {
  return makeStore({ pattern: patternStateFor(makePattern([makeLinearLayer()])) });
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PatternLibrary', () => {
  it('offers every built-in preset', () => {
    renderWithProviders(<PatternLibrary />, { store: storeFor() });

    for (const preset of presets) {
      expect(screen.getByRole('button', { name: new RegExp(preset.name) })).toBeInTheDocument();
    }
  });

  it('loads a preset over the current pattern', async () => {
    const user = userEvent.setup();
    const store = storeFor();
    renderWithProviders(<PatternLibrary />, { store });

    await user.click(screen.getByRole('button', { name: /Barber stripes/ }));

    expect(store.getState().pattern.pattern.layers[0]?.kind).toBe('repeating-linear-gradient');
    expect(screen.getByRole('status')).toHaveTextContent('Loaded “Barber stripes”');
  });

  it('says so when nothing has been saved', () => {
    renderWithProviders(<PatternLibrary />, { store: storeFor() });

    expect(screen.getByText(/Nothing saved yet/)).toBeInTheDocument();
  });

  it('saves the current pattern under a name', async () => {
    const user = userEvent.setup();
    const store = storeFor();
    renderWithProviders(<PatternLibrary />, { store });

    await user.type(screen.getByLabelText('Save current pattern as'), 'Midnight');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Saved “Midnight”');
    });

    expect(store.getState().pattern.library).toHaveLength(1);
    expect(loadLibrary()[0]?.name).toBe('Midnight');
  });

  it('will not save without a name', () => {
    renderWithProviders(<PatternLibrary />, { store: storeFor() });

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('reports a full storage quota instead of failing silently', async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });

    renderWithProviders(<PatternLibrary />, { store: storeFor() });

    await user.type(screen.getByLabelText('Save current pattern as'), 'Midnight');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Browser storage is full');
    });
  });

  it('deletes a saved pattern', async () => {
    const user = userEvent.setup();
    const store = storeFor();
    renderWithProviders(<PatternLibrary />, { store });

    await user.type(screen.getByLabelText('Save current pattern as'), 'Midnight');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await user.click(await screen.findByRole('button', { name: 'Delete Midnight' }));

    await waitFor(() => {
      expect(store.getState().pattern.library).toHaveLength(0);
    });
    expect(loadLibrary()).toHaveLength(0);
  });

  it('drops corrupted entries rather than losing the whole library', () => {
    window.localStorage.setItem(
      'pttrnly:patterns',
      JSON.stringify([
        { id: 'bad', name: 'Broken', savedAt: 1, pattern: { v: 1, layers: 'nope' } },
        { id: 'good', name: 'Fine', savedAt: 2, pattern: makePattern() },
      ]),
    );

    const library = loadLibrary();

    expect(library).toHaveLength(1);
    expect(library[0]?.name).toBe('Fine');
  });

  it('round-trips a saved library through storage', () => {
    const entry = { id: 'a', name: 'A', savedAt: 1, pattern: makePattern() };

    expect(saveLibrary([entry]).ok).toBe(true);
    expect(loadLibrary()).toEqual([entry]);
  });
});

describe('confirming before replacing unsaved work', () => {
  it('asks first when the pattern has unsaved changes', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

    const store = makeStore({
      pattern: patternStateFor(makePattern([makeLinearLayer()]), { baseline: 'something-else' }),
    });

    renderWithProviders(<PatternLibrary />, { store });

    await user.click(screen.getByRole('button', { name: /Barber stripes/ }));

    expect(confirm).toHaveBeenCalledOnce();
    // Declined, so the pattern is untouched.
    expect(store.getState().pattern.pattern.layers[0]?.kind).toBe('linear-gradient');
  });

  it('does not ask when there is nothing to lose', async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderWithProviders(<PatternLibrary />, { store: storeFor() });

    await user.click(screen.getByRole('button', { name: /Barber stripes/ }));

    expect(confirm).not.toHaveBeenCalled();
  });
});

describe('CanvasEditor', () => {
  it('edits the colour painted beneath every layer', async () => {
    const user = userEvent.setup();
    const store = storeFor();
    renderWithProviders(<CanvasEditor />, { store });

    const field = screen.getByLabelText('Base colour hex value');
    await user.clear(field);
    await user.type(field, '#0d9488');

    expect(store.getState().pattern.pattern.canvas.baseColor.h).toBeGreaterThan(150);
  });
});
