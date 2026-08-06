import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PreviewSurface } from './PreviewSurface';
import { makeStore, renderWithProviders, type TestStore } from '../../test/render';
import { layerVisibilityToggled } from '../pattern/patternSlice';
import { starterPattern } from '../pattern/starterPattern';
import { makePattern, makeRadialLayer, makeSolidLayer } from '../../test/factories';
import type { Pattern } from '../../domain/types';

/**
 * jsdom cannot parse `linear-gradient(in oklch, …)` and drops the whole
 * declaration, so DOM assertions use an sRGB pattern serialised as hex.
 * Real rendering of modern syntax belongs in Playwright.
 */
function storeWith(pattern: Pattern): TestStore {
  return makeStore({
    pattern: { pattern, output: { mode: 'longhand', colorFormat: 'hex' } },
  });
}

describe('PreviewSurface', () => {
  it('applies the generated CSS to the surface', () => {
    const pattern = makePattern([makeRadialLayer()]);
    renderWithProviders(<PreviewSurface />, { store: storeWith(pattern) });

    const surface = screen.getByRole('img', { name: 'Pattern preview' });

    // The preview has no rendering path of its own — it applies the copied bytes.
    expect(surface.style.backgroundImage).toContain('radial-gradient');
    expect(surface.style.backgroundColor).not.toBe('');
    expect(surface.style.backgroundRepeat).toBe('repeat');
  });

  it('carries per-layer blend modes through to the element', () => {
    const pattern = makePattern([
      makeRadialLayer({ blendMode: 'screen' }),
      makeSolidLayer({ id: 'base' }),
    ]);

    renderWithProviders(<PreviewSurface />, { store: storeWith(pattern) });

    const surface = screen.getByRole('img', { name: 'Pattern preview' });

    expect(surface.style.backgroundBlendMode).toBe('screen, normal');
  });

  it('explains the empty state when every layer is hidden', () => {
    const store = storeWith(starterPattern);
    for (const layer of starterPattern.layers) {
      store.dispatch(layerVisibilityToggled(layer.id));
    }

    renderWithProviders(<PreviewSurface />, { store });

    expect(screen.getByText(/Every layer is hidden/)).toBeInTheDocument();
  });

  it('has no empty state while a layer is visible', () => {
    renderWithProviders(<PreviewSurface />, { store: storeWith(starterPattern) });

    expect(screen.queryByText(/Every layer is hidden/)).not.toBeInTheDocument();
  });
});
