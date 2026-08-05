import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type ThemePreference = 'system' | 'light' | 'dark';

export type ThemeState = {
  preference: ThemePreference;
};

const initialState: ThemeState = { preference: 'system' };

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    themePreferenceChanged(state, action: PayloadAction<ThemePreference>) {
      state.preference = action.payload;
    },
  },
});

export const { themePreferenceChanged } = themeSlice.actions;
export const themeReducer = themeSlice.reducer;
