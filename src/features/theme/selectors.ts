import type { RootState } from '../../app/store';

export const selectThemePreference = (state: RootState) => state.theme.preference;
