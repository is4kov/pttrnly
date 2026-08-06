import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';
import type { ColorFormat } from '../../domain/color';
import type { OutputMode } from '../../domain/css';
import { createLayer } from '../../domain/defaults';
import type { Layer, LayerKind, Pattern } from '../../domain/types';
import { starterPattern } from './starterPattern';

export type RemovedLayer = { layer: Layer; index: number };

export type PatternState = {
  pattern: Pattern;
  selectedLayerId: string | null;
  /** The most recent deletion, kept so it can be undone while the toast is up. */
  lastRemoved: RemovedLayer | null;
  output: {
    mode: OutputMode;
    colorFormat: ColorFormat;
  };
};

const initialState: PatternState = {
  pattern: starterPattern,
  selectedLayerId: starterPattern.layers[0]?.id ?? null,
  lastRemoved: null,
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

    layerSelected(state, action: PayloadAction<string>) {
      state.selectedLayerId = action.payload;
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
  layerSelected,
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
