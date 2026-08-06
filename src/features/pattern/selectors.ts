import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../../app/store';
import { generateCss, type CssOptions } from '../../domain/css';

export const selectPattern = (state: RootState) => state.pattern.pattern;
export const selectOutputMode = (state: RootState) => state.pattern.output.mode;
export const selectColorFormat = (state: RootState) => state.pattern.output.colorFormat;

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

export const selectLayerCount = (state: RootState) => state.pattern.pattern.layers.length;

export const selectVisibleLayerCount = createSelector(
  [selectPattern],
  (pattern) => pattern.layers.filter((layer) => layer.visible).length,
);
