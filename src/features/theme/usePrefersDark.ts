import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-color-scheme: dark)';

function subscribe(onChange: () => void): () => void {
  const list = window.matchMedia(QUERY);
  list.addEventListener('change', onChange);
  return () => {
    list.removeEventListener('change', onChange);
  };
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

/** Tracks the OS colour-scheme preference. jsdom needs matchMedia stubbed — see src/test/setup.ts. */
export function usePrefersDark(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
