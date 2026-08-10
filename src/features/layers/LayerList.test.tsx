import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { LayerList } from './LayerList';
import { UndoDeleteToast } from './UndoDeleteToast';
import { makeStore, patternStateFor, renderWithProviders, type TestStore } from '../../test/render';
import { starterPattern } from '../pattern/starterPattern';
import { makePattern } from '../../test/factories';

function hexStore(): TestStore {
  return makeStore({ pattern: patternStateFor(starterPattern) });
}

describe('LayerList', () => {
  it('lists layers with the top of the stack first', () => {
    renderWithProviders(<LayerList />, { store: hexStore() });

    const rows = screen.getAllByRole('listitem');

    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Cyan glow');
    expect(rows[2]).toHaveTextContent('Diagonal wash');
  });

  it('explains the CSS ordering rule', () => {
    renderWithProviders(<LayerList />, { store: hexStore() });

    expect(screen.getByText(/top layer paints over the ones below/i)).toBeInTheDocument();
  });

  it('toggles a layer between hidden and visible', async () => {
    const user = userEvent.setup();
    const store = hexStore();
    renderWithProviders(<LayerList />, { store });

    const toggle = screen.getByRole('switch', { name: 'Cyan glow visible' });
    expect(toggle).toBeChecked();

    await user.click(toggle);

    expect(store.getState().pattern.pattern.layers[0]?.visible).toBe(false);
    // A switch reports state through aria-checked rather than by relabelling
    // itself, so the name stays put and only the state flips.
    expect(screen.getByRole('switch', { name: 'Cyan glow visible' })).not.toBeChecked();
  });

  it('moves a layer up the stack', async () => {
    const user = userEvent.setup();
    const store = hexStore();
    renderWithProviders(<LayerList />, { store });

    await user.click(screen.getByRole('button', { name: 'Move Magenta glow up' }));

    expect(store.getState().pattern.pattern.layers[0]?.name).toBe('Magenta glow');
  });

  it('disables move up on the first row and move down on the last', () => {
    renderWithProviders(<LayerList />, { store: hexStore() });

    expect(screen.getByRole('button', { name: 'Move Cyan glow up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move Diagonal wash down' })).toBeDisabled();
  });

  it('duplicates a layer directly above the original', async () => {
    const user = userEvent.setup();
    const store = hexStore();
    renderWithProviders(<LayerList />, { store });

    await user.click(screen.getByRole('button', { name: 'Duplicate Cyan glow' }));

    const layers = store.getState().pattern.pattern.layers;

    expect(layers).toHaveLength(4);
    expect(layers[0]?.name).toBe('Cyan glow copy');
    expect(layers[0]?.id).not.toBe(layers[1]?.id);
  });

  it('selects a layer when its name is activated', async () => {
    const user = userEvent.setup();
    const store = hexStore();
    renderWithProviders(<LayerList />, { store });

    await user.click(screen.getByRole('button', { name: 'Select Magenta glow' }));

    expect(store.getState().pattern.selectedLayerId).toBe('starter-glow-2');
  });

  it('shows an empty state with no layers', () => {
    const store = makeStore({ pattern: patternStateFor(makePattern([])) });

    renderWithProviders(<LayerList />, { store });

    expect(screen.getByText(/No layers yet/)).toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });
});

describe('deleting a layer', () => {
  it('removes it and offers an undo', async () => {
    const user = userEvent.setup();
    const store = hexStore();

    renderWithProviders(
      <>
        <LayerList />
        <UndoDeleteToast />
      </>,
      { store },
    );

    await user.click(screen.getByRole('button', { name: 'Delete Cyan glow' }));

    expect(store.getState().pattern.pattern.layers).toHaveLength(2);
    expect(screen.getByRole('status')).toHaveTextContent('Deleted “Cyan glow”.');
  });

  it('restores the layer at its original index', async () => {
    const user = userEvent.setup();
    const store = hexStore();

    renderWithProviders(
      <>
        <LayerList />
        <UndoDeleteToast />
      </>,
      { store },
    );

    await user.click(screen.getByRole('button', { name: 'Delete Magenta glow' }));
    await user.click(screen.getByRole('button', { name: 'Undo' }));

    const layers = store.getState().pattern.pattern.layers;

    expect(layers).toHaveLength(3);
    expect(layers[1]?.name).toBe('Magenta glow');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('has nothing to undo before a deletion', () => {
    renderWithProviders(<UndoDeleteToast />, { store: hexStore() });

    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
  });

  /*
    The drag itself needs a real browser and lives in e2e/layer-reorder.spec.ts.
    What jsdom can still hold us to is that the drag never became the *only*
    way to reorder, which is the accessibility requirement.
  */
  it('keeps a drag handle out of the accessibility tree', () => {
    renderWithProviders(<LayerList />, { store: hexStore() });

    const handles = screen.getAllByTestId('drag-handle');

    expect(handles).toHaveLength(3);
    handles.forEach((handle) => {
      expect(handle).toHaveAttribute('aria-hidden', 'true');
      expect(handle).not.toHaveAttribute('tabindex');
    });
  });

  it('still exposes a non-drag path for reordering', () => {
    renderWithProviders(<LayerList />, { store: hexStore() });

    expect(screen.getByRole('button', { name: 'Move Cyan glow down' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Move Diagonal wash up' })).toBeEnabled();
  });
});
