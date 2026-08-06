import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ColorFormat } from '../../domain/color';
import type { OutputMode } from '../../domain/css';
import type { Pattern } from '../../domain/types';
import { starterPattern } from './starterPattern';

export type PatternState = {
  pattern: Pattern;
  output: {
    mode: OutputMode;
    colorFormat: ColorFormat;
  };
};

const initialState: PatternState = {
  pattern: starterPattern,
  output: { mode: 'longhand', colorFormat: 'oklch' },
};

/**
 * Actions describe the edit semantically rather than replacing state wholesale,
 * so a history middleware stays a cheap addition later — see CLAUDE.md.
 */
const patternSlice = createSlice({
  name: 'pattern',
  initialState,
  reducers: {
    outputModeChanged(state, action: PayloadAction<OutputMode>) {
      state.output.mode = action.payload;
    },
    colorFormatChanged(state, action: PayloadAction<ColorFormat>) {
      state.output.colorFormat = action.payload;
    },
    layerVisibilityToggled(state, action: PayloadAction<string>) {
      const layer = state.pattern.layers.find((candidate) => candidate.id === action.payload);
      if (layer) layer.visible = !layer.visible;
    },
  },
});

export const { outputModeChanged, colorFormatChanged, layerVisibilityToggled } =
  patternSlice.actions;
export const patternReducer = patternSlice.reducer;
