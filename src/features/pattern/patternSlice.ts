import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';
import type { ColorFormat } from '../../domain/color';
import type { OutputMode } from '../../domain/css';
import { createLayer } from '../../domain/defaults';
import { MAX_STOPS, MIN_STOPS, sortStops } from '../../domain/stops';
import type { Color } from '../../domain/color';
import type { Length } from '../../domain/length';
import type { GradientStop } from '../../domain/types';
import type { Layer, LayerKind, Pattern } from '../../domain/types';
import { starterPattern } from './starterPattern';
import { loadSession, type SavedPattern } from '../persistence/storage';
import type { Canvas } from '../../domain/types';

export type RemovedLayer = { layer: Layer; index: number };

export type PatternState = {
  pattern: Pattern;
  /**
   * Snapshot of the pattern as last loaded or saved. Comparing against it is
   * how "unsaved changes" is derived, rather than a flag that can drift.
   */
  baseline: string;
  library: SavedPattern[];
  selectedLayerId: string | null;
  /** Index into the selected layer's stop list; the stop being edited. */
  selectedStopIndex: number;
  /** The most recent deletion, kept so it can be undone while the toast is up. */
  lastRemoved: RemovedLayer | null;
  output: {
    mode: OutputMode;
    colorFormat: ColorFormat;
  };
};

const restored = loadSession();
const initial = restored ?? starterPattern;

const initialState: PatternState = {
  pattern: initial,
  baseline: JSON.stringify(initial),
  library: [],
  selectedLayerId: initial.layers[0]?.id ?? null,
  selectedStopIndex: 0,
  lastRemoved: null,
  output: { mode: 'longhand', colorFormat: 'oklch' },
};

/** Narrows to a layer that actually has stops, so the reducers stay total. */
function gradientStops(state: PatternState, layerId: string): GradientStop[] | null {
  const layer = state.pattern.layers.find((candidate) => candidate.id === layerId);
  if (!layer) return null;
  return 'stops' in layer ? layer.stops : null;
}

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

    /** Replaces the whole pattern — loading a preset or a saved design. */
    patternLoaded(state, action: PayloadAction<Pattern>) {
      state.pattern = action.payload;
      state.baseline = JSON.stringify(action.payload);
      state.selectedLayerId = action.payload.layers[0]?.id ?? null;
      state.selectedStopIndex = 0;
    },

    baseColorChanged(state, action: PayloadAction<Canvas['baseColor']>) {
      state.pattern.canvas.baseColor = action.payload;
    },

    libraryLoaded(state, action: PayloadAction<SavedPattern[]>) {
      state.library = action.payload;
    },

    patternSaved(state, action: PayloadAction<SavedPattern>) {
      state.library.unshift(action.payload);
      state.baseline = JSON.stringify(state.pattern);
    },

    savedPatternRemoved(state, action: PayloadAction<string>) {
      state.library = state.library.filter((entry) => entry.id !== action.payload);
    },

    layerSelected(state, action: PayloadAction<string>) {
      state.selectedLayerId = action.payload;
      state.selectedStopIndex = 0;
    },

    stopSelected(state, action: PayloadAction<number>) {
      state.selectedStopIndex = Math.max(action.payload, 0);
    },

    stopMoved(state, action: PayloadAction<{ layerId: string; index: number; position: Length }>) {
      const { layerId, index, position } = action.payload;
      const stops = gradientStops(state, layerId);
      const stop = stops?.[index];
      if (!stops || !stop) return;

      stop.position = position;
    },

    stopColorChanged(
      state,
      action: PayloadAction<{ layerId: string; index: number; color: Color }>,
    ) {
      const { layerId, index, color } = action.payload;
      const stop = gradientStops(state, layerId)?.[index];
      if (!stop) return;

      stop.color = color;
    },

    /**
     * Re-sorts after a drag. Sorting mid-drag would swap the index under the
     * pointer; CSS meanwhile clamps an out-of-order stop to its predecessor,
     * which reads as the handle sticking. So it happens once, on release.
     */
    stopsNormalised(state, action: PayloadAction<{ layerId: string }>) {
      const stops = gradientStops(state, action.payload.layerId);
      if (!stops) return;

      const moved = stops[state.selectedStopIndex];
      const sorted = sortStops(stops);
      stops.splice(0, stops.length, ...sorted);

      if (moved) {
        state.selectedStopIndex = sorted.indexOf(moved);
      }
    },

    stopAdded(state, action: PayloadAction<{ layerId: string; stop: GradientStop }>) {
      const { layerId, stop } = action.payload;
      const stops = gradientStops(state, layerId);
      if (!stops || stops.length >= MAX_STOPS) return;

      stops.push(stop);
      const sorted = sortStops(stops);
      stops.splice(0, stops.length, ...sorted);
      state.selectedStopIndex = sorted.findIndex((candidate) => candidate === stop);
    },

    /** CSS needs two stops for a valid gradient, so the last pair cannot be removed. */
    stopRemoved(state, action: PayloadAction<{ layerId: string; index: number }>) {
      const { layerId, index } = action.payload;
      const stops = gradientStops(state, layerId);
      if (!stops || stops.length <= MIN_STOPS) return;

      stops.splice(index, 1);
      state.selectedStopIndex = Math.min(index, stops.length - 1);
    },

    layerAdded: {
      reducer(state, action: PayloadAction<{ kind: LayerKind; id: string }>) {
        const layer = createLayer(action.payload.kind, action.payload.id);
        const at = state.selectedLayerId
          ? state.pattern.layers.findIndex((candidate) => candidate.id === state.selectedLayerId)
          : 0;

        state.pattern.layers.splice(Math.max(at, 0), 0, layer);
        state.selectedLayerId = layer.id;
      },
      prepare(kind: LayerKind) {
        return { payload: { kind, id: nanoid() } };
      },
    },

    /**
     * Semantic property edit. `changes` carries only the fields that moved,
     * which keeps a future history middleware able to describe what happened.
     */
    layerUpdated(state, action: PayloadAction<{ id: string; changes: Partial<Layer> }>) {
      const layer = state.pattern.layers.find((candidate) => candidate.id === action.payload.id);
      if (!layer) return;

      // Safe: the panel only ever sends fields valid for this layer's kind, and
      // `kind` itself is not editable.
      Object.assign(layer, action.payload.changes);
    },

    layerVisibilityToggled(state, action: PayloadAction<string>) {
      const layer = state.pattern.layers.find((candidate) => candidate.id === action.payload);
      if (layer) layer.visible = !layer.visible;
    },

    /** Index 0 is the top of the stack, so "up" means towards 0. */
    layerMoved(state, action: PayloadAction<{ id: string; direction: 'up' | 'down' }>) {
      const { id, direction } = action.payload;
      const from = state.pattern.layers.findIndex((layer) => layer.id === id);
      if (from === -1) return;

      const to = direction === 'up' ? from - 1 : from + 1;
      if (to < 0 || to >= state.pattern.layers.length) return;

      const [moved] = state.pattern.layers.splice(from, 1);
      if (moved) state.pattern.layers.splice(to, 0, moved);
    },

    layerDuplicated: {
      reducer(state, action: PayloadAction<{ id: string; newId: string }>) {
        const index = state.pattern.layers.findIndex((layer) => layer.id === action.payload.id);
        const source = state.pattern.layers[index];
        if (index === -1 || !source) return;

        const copy: Layer = {
          ...source,
          id: action.payload.newId,
          name: `${source.name} copy`,
        };

        state.pattern.layers.splice(index, 0, copy);
        state.selectedLayerId = copy.id;
      },
      // Ids are generated here, never inside the reducer and never during render.
      prepare(id: string) {
        return { payload: { id, newId: nanoid() } };
      },
    },

    layerRemoved(state, action: PayloadAction<string>) {
      const index = state.pattern.layers.findIndex((layer) => layer.id === action.payload);
      const removed = state.pattern.layers[index];
      if (index === -1 || !removed) return;

      state.pattern.layers.splice(index, 1);
      state.lastRemoved = { layer: removed, index };

      if (state.selectedLayerId === action.payload) {
        const fallback = state.pattern.layers[index] ?? state.pattern.layers[index - 1];
        state.selectedLayerId = fallback?.id ?? null;
      }
    },

    /** Puts the deleted layer back where it was, for the undo affordance. */
    lastRemovalUndone(state) {
      const removal = state.lastRemoved;
      if (!removal) return;

      const at = Math.min(Math.max(removal.index, 0), state.pattern.layers.length);
      state.pattern.layers.splice(at, 0, removal.layer);
      state.selectedLayerId = removal.layer.id;
      state.lastRemoved = null;
    },

    /** Drops the undo opportunity once the toast has timed out or been dismissed. */
    lastRemovalDismissed(state) {
      state.lastRemoved = null;
    },
  },
});

export const {
  outputModeChanged,
  colorFormatChanged,
  patternLoaded,
  baseColorChanged,
  libraryLoaded,
  patternSaved,
  savedPatternRemoved,
  layerSelected,
  stopSelected,
  stopMoved,
  stopColorChanged,
  stopAdded,
  stopRemoved,
  stopsNormalised,
  layerAdded,
  layerUpdated,
  layerVisibilityToggled,
  layerMoved,
  layerDuplicated,
  layerRemoved,
  lastRemovalUndone,
  lastRemovalDismissed,
} = patternSlice.actions;

export const patternReducer = patternSlice.reducer;
