import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { LayerEditor } from './LayerEditor';
import { makeStore, patternStateFor, renderWithProviders } from '../../test/render';
import {
  makeLinearLayer,
  makePattern,
  makeSolidLayer,
  makeStripeLayer,
} from '../../test/factories';
import type { Layer } from '../../domain/types';
import { MAX_STOPS } from '../../domain/stops';

/**
 * Dragging is not covered here: jsdom has no Pointer Events, so pointer drag
 * is verified in Playwright. These tests cover the keyboard path, which
 * CLAUDE.md requires to work standalone anyway.
 */
function storeFor(layers: Layer[]) {
  return makeStore({ pattern: patternStateFor(makePattern(layers)) });
}

const stopsOf = (store: ReturnType<typeof storeFor>) => {
  const layer = store.getState().pattern.pattern.layers[0];
  return layer && 'stops' in layer ? layer.stops : [];
};

describe('StopBar', () => {
  it('renders one slider per stop', () => {
    renderWithProviders(<LayerEditor />, { store: storeFor([makeLinearLayer()]) });

    expect(screen.getAllByRole('slider', { name: /^Stop \d$/ })).toHaveLength(2);
  });

  it('describes each stop by position and colour', () => {
    renderWithProviders(<LayerEditor />, { store: storeFor([makeLinearLayer()]) });

    const first = screen.getByRole('slider', { name: 'Stop 1' });

    expect(first).toHaveAttribute('aria-valuenow', '0');
    expect(first.getAttribute('aria-valuetext')).toMatch(/^0%, #[0-9a-f]{6}$/);
  });

  it('shows the track span, which follows the largest offset', () => {
    renderWithProviders(<LayerEditor />, { store: storeFor([makeStripeLayer()]) });

    expect(screen.getByText('0 to 30px')).toBeInTheDocument();
  });

  it('nudges a stop with arrow keys', async () => {
    const user = userEvent.setup();
    const store = storeFor([makeLinearLayer()]);
    renderWithProviders(<LayerEditor />, { store });

    await user.click(screen.getByRole('slider', { name: 'Stop 1' }));
    await user.keyboard('{ArrowRight}');

    expect(stopsOf(store)[0]?.position.value).toBe(1);
  });

  it('takes a coarse step with shift', async () => {
    const user = userEvent.setup();
    const store = storeFor([makeLinearLayer()]);
    renderWithProviders(<LayerEditor />, { store });

    await user.click(screen.getByRole('slider', { name: 'Stop 1' }));
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}');

    expect(stopsOf(store)[0]?.position.value).toBe(10);
  });

  it('jumps to either end with Home and End', async () => {
    const user = userEvent.setup();
    const store = storeFor([makeLinearLayer()]);
    renderWithProviders(<LayerEditor />, { store });

    await user.click(screen.getByRole('slider', { name: 'Stop 2' }));
    await user.keyboard('{Home}');

    expect(stopsOf(store)[1]?.position.value).toBe(0);
  });

  it('clamps a stop to the track', async () => {
    const user = userEvent.setup();
    const store = storeFor([makeLinearLayer()]);
    renderWithProviders(<LayerEditor />, { store });

    await user.click(screen.getByRole('slider', { name: 'Stop 1' }));
    await user.keyboard('{ArrowLeft}{ArrowLeft}');

    expect(stopsOf(store)[0]?.position.value).toBe(0);
  });

  it('announces a move politely', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LayerEditor />, { store: storeFor([makeLinearLayer()]) });

    await user.click(screen.getByRole('slider', { name: 'Stop 1' }));
    await user.keyboard('{ArrowRight}');

    expect(screen.getByRole('status')).toHaveTextContent('Stop 1 at 1%');
  });

  it('refuses to drop below two stops', async () => {
    const user = userEvent.setup();
    const store = storeFor([makeLinearLayer()]);
    renderWithProviders(<LayerEditor />, { store });

    await user.click(screen.getByRole('slider', { name: 'Stop 1' }));
    await user.keyboard('{Delete}');

    expect(stopsOf(store)).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Remove stop' })).toBeDisabled();
  });

  it('removes a stop once there are more than two', async () => {
    const user = userEvent.setup();
    const store = storeFor([makeStripeLayer()]);
    renderWithProviders(<LayerEditor />, { store });

    expect(stopsOf(store)).toHaveLength(4);

    await user.click(screen.getByRole('slider', { name: 'Stop 2' }));
    await user.keyboard('{Delete}');

    expect(stopsOf(store)).toHaveLength(3);
  });

  it('edits the selected stop colour through the picker', async () => {
    const user = userEvent.setup();
    const store = storeFor([makeLinearLayer()]);
    renderWithProviders(<LayerEditor />, { store });

    await user.click(screen.getByRole('slider', { name: 'Hue' }));
    await user.keyboard('{ArrowRight}');

    expect(stopsOf(store)[0]?.color.h).toBeGreaterThan(0);
  });

  it('follows the selected stop when focus moves', async () => {
    const user = userEvent.setup();
    const store = storeFor([makeLinearLayer()]);
    renderWithProviders(<LayerEditor />, { store });

    await user.click(screen.getByRole('slider', { name: 'Stop 2' }));

    expect(screen.getByRole('group', { name: 'Stop 2 colour' })).toBeInTheDocument();
    expect(store.getState().pattern.selectedStopIndex).toBe(1);
  });

  it('is absent for layers without stops', () => {
    renderWithProviders(<LayerEditor />, { store: storeFor([makeSolidLayer()]) });

    expect(screen.queryByRole('slider', { name: 'Stop 1' })).not.toBeInTheDocument();
  });
});

describe('StopTabs', () => {
  it('gives every stop a tab', () => {
    renderWithProviders(<LayerEditor />, { store: storeFor([makeStripeLayer()]) });

    expect(screen.getAllByRole('tab')).toHaveLength(4);
  });

  it('marks the selected tab and shows only its properties', () => {
    renderWithProviders(<LayerEditor />, { store: storeFor([makeLinearLayer()]) });

    expect(screen.getByRole('tab', { name: 'Stop 1' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Stop 1 position')).toBeInTheDocument();
    expect(screen.queryByLabelText('Stop 2 position')).not.toBeInTheDocument();
  });

  it('selects a stop that would be impossible to grab on the bar', async () => {
    const user = userEvent.setup();
    const store = storeFor([makeStripeLayer()]);
    renderWithProviders(<LayerEditor />, { store });

    // Stops 2 and 3 sit at the same offset, so their handles overlap exactly.
    await user.click(screen.getByRole('tab', { name: 'Stop 3' }));

    expect(store.getState().pattern.selectedStopIndex).toBe(2);
    expect(screen.getByLabelText('Stop 3 position')).toBeInTheDocument();
  });

  it('moves between tabs with arrow keys, wrapping at the ends', async () => {
    const user = userEvent.setup();
    const store = storeFor([makeLinearLayer()]);
    renderWithProviders(<LayerEditor />, { store });

    await user.click(screen.getByRole('tab', { name: 'Stop 1' }));
    await user.keyboard('{ArrowRight}');

    expect(store.getState().pattern.selectedStopIndex).toBe(1);

    await user.keyboard('{ArrowRight}');

    expect(store.getState().pattern.selectedStopIndex).toBe(0);
  });

  it('keeps the strip to a single tab stop', () => {
    renderWithProviders(<LayerEditor />, { store: storeFor([makeLinearLayer()]) });

    expect(screen.getByRole('tab', { name: 'Stop 1' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Stop 2' })).toHaveAttribute('tabindex', '-1');
  });

  it('moves the selected stop by typing an exact position', async () => {
    const user = userEvent.setup();
    const store = storeFor([makeLinearLayer()]);
    renderWithProviders(<LayerEditor />, { store });

    const field = screen.getByLabelText('Stop 1 position');
    await user.clear(field);
    await user.type(field, '35');

    expect(stopsOf(store)[0]?.position.value).toBe(35);
  });

  it('removes the selected stop from its panel', async () => {
    const user = userEvent.setup();
    const store = storeFor([makeStripeLayer()]);
    renderWithProviders(<LayerEditor />, { store });

    await user.click(screen.getByRole('tab', { name: 'Stop 2' }));
    await user.click(screen.getByRole('button', { name: 'Remove stop 2' }));

    expect(stopsOf(store)).toHaveLength(3);
  });

  it('will not remove below two stops', () => {
    renderWithProviders(<LayerEditor />, { store: storeFor([makeLinearLayer()]) });

    expect(screen.getByRole('button', { name: 'Remove stop 1' })).toBeDisabled();
  });

  it('can change a single stop to pixels', async () => {
    const user = userEvent.setup();
    const store = storeFor([makeLinearLayer()]);
    renderWithProviders(<LayerEditor />, { store });

    await user.selectOptions(screen.getByLabelText('Stop 1 position unit'), 'px');

    expect(stopsOf(store)[0]?.position.unit).toBe('px');
  });
});

describe('adding stops', () => {
  it('lets clicks through the gradient ramp', () => {
    const { container } = renderWithProviders(<LayerEditor />, {
      store: storeFor([makeLinearLayer()]),
    });

    // The ramp covers the whole track. If it captured pointer events, every
    // click would land on it and adding a stop would silently do nothing —
    // which is exactly the bug this guards.
    const ramp = container.querySelector('[data-testid="stop-track"] > div');

    expect(ramp).not.toBeNull();
    if (!ramp) return;
    expect(getComputedStyle(ramp).pointerEvents).toBe('none');
  });

  it('adds a stop when the track itself is clicked', async () => {
    const user = userEvent.setup();
    const store = storeFor([makeLinearLayer()]);
    renderWithProviders(<LayerEditor />, { store });

    await user.click(screen.getByTestId('stop-track'));

    expect(stopsOf(store)).toHaveLength(3);
  });

  it('does not add a stop when a handle is clicked', async () => {
    const user = userEvent.setup();
    const store = storeFor([makeLinearLayer()]);
    renderWithProviders(<LayerEditor />, { store });

    await user.click(screen.getByRole('slider', { name: 'Stop 1' }));

    expect(stopsOf(store)).toHaveLength(2);
  });

  it('refuses to exceed the stop cap', async () => {
    const user = userEvent.setup();
    const store = storeFor([makeLinearLayer()]);
    renderWithProviders(<LayerEditor />, { store });

    const track = screen.getByTestId('stop-track');
    for (let i = 0; i < MAX_STOPS + 5; i += 1) {
      await user.click(track);
    }

    expect(stopsOf(store)).toHaveLength(MAX_STOPS);
    expect(screen.getByRole('status')).toHaveTextContent('at most 64 stops');
  });
});
