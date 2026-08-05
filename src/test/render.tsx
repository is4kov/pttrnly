import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { themeReducer } from '../features/theme/themeSlice';
import type { RootState } from '../app/store';

export function makeStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: { theme: themeReducer },
    ...(preloadedState ? { preloadedState: preloadedState as RootState } : {}),
  });
}

export type TestStore = ReturnType<typeof makeStore>;

type Options = Omit<RenderOptions, 'wrapper'> & {
  store?: TestStore;
};

export function renderWithProviders(
  ui: ReactElement,
  { store = makeStore(), ...options }: Options = {},
): RenderResult & { store: TestStore } {
  function Wrapper({ children }: { children: ReactNode }) {
    return <Provider store={store}>{children}</Provider>;
  }

  return { store, ...render(ui, { wrapper: Wrapper, ...options }) };
}
