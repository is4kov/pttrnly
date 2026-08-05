import { describe, expect, it } from 'vitest';
import { themePreferenceChanged, themeReducer, type ThemeState } from './themeSlice';

describe('themeSlice', () => {
  it('defaults to following the system preference', () => {
    const state = themeReducer(undefined, { type: '@@INIT' });

    expect(state).toEqual<ThemeState>({ preference: 'system' });
  });

  it('records an explicit preference', () => {
    const state = themeReducer({ preference: 'system' }, themePreferenceChanged('dark'));

    expect(state.preference).toBe('dark');
  });
});
