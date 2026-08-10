import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { LayerEditor } from './LayerEditor';
import { AddLayerButton } from '../layers/AddLayerButton';
import { makeStore, patternStateFor, renderWithProviders, type TestStore } from '../../test/render';
import { makeConicLayer, makeLinearLayer, makePattern, makeSolidLayer } from '../../test/factories';
import { makeImageLayer, makeRadialLayer } from '../../test/factories';
import type { Layer } from '../../domain/types';

function storeWith(layers: Layer[], selectedIndex = 0): TestStore {
  const pattern = makePattern(layers);
  return makeStore({
    pattern: patternStateFor(pattern, {
      selectedLayerId: pattern.layers[selectedIndex]?.id ?? null,
    }),
  });
}

describe('LayerEditor', () => {
  it('prompts when nothing is selected', () => {
    const store = makeStore({ pattern: patternStateFor(makePattern([])) });

    renderWithProviders(<LayerEditor />, { store });

    expect(screen.getByText('Select a layer to edit it.')).toBeInTheDocument();
  });

  it('renames a layer', async () => {
    const user = userEvent.setup();
    const store = storeWith([makeLinearLayer()]);
    renderWithProviders(<LayerEditor />, { store });

    const field = screen.getByLabelText('Name');
    await user.clear(field);
    await user.type(field, 'Sunset');

    expect(store.getState().pattern.pattern.layers[0]?.name).toBe('Sunset');
  });

  it('changes the blend mode', async () => {
    const user = userEvent.setup();
    const store = storeWith([makeLinearLayer()]);
    renderWithProviders(<LayerEditor />, { store });

    await user.selectOptions(screen.getByLabelText('Blend mode'), 'multiply');

    expect(store.getState().pattern.pattern.layers[0]?.blendMode).toBe('multiply');
  });

  it('edits the angle of a linear gradient through the number input', async () => {
    const user = userEvent.setup();
    const store = storeWith([makeLinearLayer({ angle: 90 })]);
    renderWithProviders(<LayerEditor />, { store });

    const field = screen.getByLabelText('Angle (deg)');
    await user.clear(field);
    await user.type(field, '45');

    const layer = store.getState().pattern.pattern.layers[0];

    expect(layer && 'angle' in layer ? layer.angle : null).toBe(45);
  });

  it('offers a slider alongside the number input', () => {
    renderWithProviders(<LayerEditor />, { store: storeWith([makeLinearLayer()]) });

    expect(screen.getByRole('slider', { name: 'Angle (deg) slider' })).toBeInTheDocument();
  });

  it('reveals width and height only for a custom size', async () => {
    const user = userEvent.setup();
    const store = storeWith([makeLinearLayer()]);
    renderWithProviders(<LayerEditor />, { store });

    expect(screen.queryByLabelText('Width')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Size'), 'custom');

    expect(screen.getByLabelText('Width')).toBeInTheDocument();
    expect(store.getState().pattern.pattern.layers[0]?.size.kind).toBe('custom');
  });

  it('switches a length between percent and pixels', async () => {
    const user = userEvent.setup();
    const store = storeWith([makeLinearLayer()]);
    renderWithProviders(<LayerEditor />, { store });

    await user.selectOptions(screen.getByLabelText('Size'), 'custom');
    await user.selectOptions(screen.getByLabelText('Width unit'), 'px');

    const size = store.getState().pattern.pattern.layers[0]?.size;

    expect(size?.kind).toBe('custom');
    expect(size?.kind === 'custom' && size.width !== 'auto' ? size.width.unit : null).toBe('px');
  });

  it('explains why repeat looks inert while the size fills the canvas', async () => {
    const user = userEvent.setup();
    const store = storeWith([makeLinearLayer({ repeat: 'repeat' })]);
    renderWithProviders(<LayerEditor />, { store });

    expect(screen.getByText(/Repeat has no visible effect/)).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Size'), 'custom');

    expect(screen.queryByText(/Repeat has no visible effect/)).not.toBeInTheDocument();
  });

  it('shows shape and extent for a radial gradient', () => {
    renderWithProviders(<LayerEditor />, { store: storeWith([makeRadialLayer()]) });

    expect(screen.getByLabelText('Shape')).toBeInTheDocument();
    expect(screen.getByLabelText('Extent')).toBeInTheDocument();
    expect(screen.queryByLabelText('Angle (deg)')).not.toBeInTheDocument();
  });

  it('shows the origin angle for a conic gradient', () => {
    renderWithProviders(<LayerEditor />, { store: storeWith([makeConicLayer()]) });

    expect(screen.getByLabelText('From angle (deg)')).toBeInTheDocument();
  });

  it('edits a solid layer colour from the hex field', async () => {
    const user = userEvent.setup();
    const store = storeWith([makeSolidLayer()]);
    renderWithProviders(<LayerEditor />, { store });

    const field = screen.getByLabelText('Fill');
    await user.clear(field);
    await user.type(field, '#0d9488');

    const layer = store.getState().pattern.pattern.layers[0];
    const changed = layer && 'color' in layer ? layer.color : null;

    expect(changed).not.toBeNull();
    expect(changed?.h).toBeGreaterThan(150);
  });

  it('reports an unparseable colour without changing state', async () => {
    const user = userEvent.setup();
    const store = storeWith([makeSolidLayer()]);
    const before = store.getState().pattern.pattern.layers[0];
    renderWithProviders(<LayerEditor />, { store });

    const field = screen.getByLabelText('Fill');
    await user.clear(field);
    await user.type(field, 'nonsense');

    expect(screen.getByText(/Not a hex colour/)).toBeInTheDocument();
    expect(store.getState().pattern.pattern.layers[0]).toEqual(before);
  });

  it('warns when an image URL would be rejected', async () => {
    const user = userEvent.setup();
    const store = storeWith([makeImageLayer({ url: '' })]);
    renderWithProviders(<LayerEditor />, { store });

    const field = screen.getByLabelText('URL');
    await user.type(field, 'javascript:alert(1)');

    expect(screen.getByText(/Rejected/)).toBeInTheDocument();
    expect(field).toHaveAttribute('aria-invalid', 'true');
  });

  it('accepts an https image URL', async () => {
    const user = userEvent.setup();
    const store = storeWith([makeImageLayer({ url: '' })]);
    renderWithProviders(<LayerEditor />, { store });

    await user.type(screen.getByLabelText('URL'), 'https://example.com/a.png');

    expect(screen.getByLabelText('URL')).toHaveAttribute('aria-invalid', 'false');
  });
});

describe('AddLayerButton', () => {
  it('keeps the choices behind the button until asked', () => {
    renderWithProviders(<AddLayerButton />, { store: storeWith([makeLinearLayer()]) });

    expect(screen.getByRole('button', { name: 'Add layer' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Conic gradient' })).not.toBeInTheDocument();
  });

  it('creates a layer of the chosen kind and selects it', async () => {
    const user = userEvent.setup();
    const store = storeWith([makeLinearLayer()]);
    renderWithProviders(<AddLayerButton />, { store });

    await user.click(screen.getByRole('button', { name: 'Add layer' }));
    await user.click(screen.getByRole('button', { name: 'Conic gradient' }));

    const state = store.getState().pattern;

    expect(state.pattern.layers).toHaveLength(2);
    expect(state.pattern.layers[0]?.kind).toBe('conic-gradient');
    expect(state.selectedLayerId).toBe(state.pattern.layers[0]?.id);
  });

  it('closes once a kind is chosen', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AddLayerButton />, { store: storeWith([makeLinearLayer()]) });

    await user.click(screen.getByRole('button', { name: 'Add layer' }));
    await user.click(screen.getByRole('button', { name: 'Conic gradient' }));

    expect(screen.queryByRole('button', { name: 'Conic gradient' })).not.toBeInTheDocument();
  });

  it('recovers from the empty state', async () => {
    const user = userEvent.setup();
    const store = makeStore({ pattern: patternStateFor(makePattern([])) });

    renderWithProviders(<AddLayerButton />, { store });

    await user.click(screen.getByRole('button', { name: 'Add layer' }));
    await user.click(screen.getByRole('button', { name: 'Linear gradient' }));

    expect(store.getState().pattern.pattern.layers).toHaveLength(1);
  });
});
