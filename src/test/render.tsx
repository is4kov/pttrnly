import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { ThemeProvider } from 'styled-components';
import { themeReducer } from '../features/theme/themeSlice';
import { patternReducer } from '../features/pattern/patternSlice';
import { lightTheme } from '../styles/theme';
import type { RootState } from '../app/store';
import type { PatternState } from '../features/pattern/patternSlice';
import type { Pattern } from '../domain/types';

export function makeStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: { theme: themeReducer, pattern: patternReducer },
    ...(preloadedState ? { preloadedState: preloadedState as RootState } : {}),
  });
}

export type TestStore = ReturnType<typeof makeStore>;

/**
 * Builds pattern state from a pattern. Tests go through this so adding a field
 * to PatternState does not mean editing every test that preloads state.
 */
export function patternStateFor(
  pattern: Pattern,
  overrides: Partial<PatternState> = {},
): PatternState {
  return {
    pattern,
    selectedLayerId: pattern.layers[0]?.id ?? null,
    selectedStopIndex: 0,
    lastRemoved: null,
    output: { mode: 'longhand', colorFormat: 'hex' },
    ...overrides,
  };
}

type Options = Omit<RenderOptions, 'wrapper'> & {
  store?: TestStore;
};

export function renderWithProviders(
  ui: ReactElement,
  { store = makeStore(), ...options }: Options = {},
): RenderResult & { store: TestStore } {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>
      </Provider>
    );
  }

  return { store, ...render(ui, { wrapper: Wrapper, ...options }) };
}
