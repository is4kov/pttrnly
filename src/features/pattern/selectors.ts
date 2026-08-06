import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../../app/store';
import { generateCss, type CssOptions } from '../../domain/css';
import type { Layer, Pattern } from '../../domain/types';

export const selectPattern = (state: RootState) => state.pattern.pattern;
export const selectOutputMode = (state: RootState) => state.pattern.output.mode;
export const selectColorFormat = (state: RootState) => state.pattern.output.colorFormat;
export const selectSelectedLayerId = (state: RootState) => state.pattern.selectedLayerId;
export const selectSelectedStopIndex = (state: RootState) => state.pattern.selectedStopIndex;

const selectCssOptions = createSelector(
  [selectOutputMode, selectColorFormat],
  (mode, colorFormat): CssOptions => ({ mode, colorFormat }),
);

/**
 * The single source of truth for what the user sees and what they copy.
 * Memoized because generation runs on every render of both consumers.
 */
export const selectGeneratedCss = createSelector(
  [selectPattern, selectCssOptions],
  (pattern, options) => generateCss(pattern, options),
);

export const selectLayers = (state: RootState) => state.pattern.pattern.layers;

/** Ids only, so the list re-renders on reorder but not on a layer's own edits. */
export const selectLayerIds = createSelector([selectLayers], (layers) =>
  layers.map((layer) => layer.id),
);

/** A row subscribes to its own layer, never to the whole array. */
export const selectLayerById = (state: RootState, id: string): Layer | undefined =>
  state.pattern.pattern.layers.find((layer) => layer.id === id);

export const selectLayerIndex = (state: RootState, id: string): number =>
  state.pattern.pattern.layers.findIndex((layer) => layer.id === id);

export const selectLayerCount = (state: RootState) => state.pattern.pattern.layers.length;

export const selectVisibleLayerCount = createSelector(
  [selectPattern],
  (pattern) => pattern.layers.filter((layer) => layer.visible).length,
);

/** Isolates one layer over a transparent canvas, for the row thumbnails. */
export function makeSwatchPattern(pattern: Pattern, layer: Layer): Pattern {
  return {
    v: pattern.v,
    layers: [{ ...layer, visible: true }],
    canvas: { ...pattern.canvas, baseColor: { l: 0, c: 0, h: 0, alpha: 0 } },
  };
}
