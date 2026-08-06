import { useEffect, useRef, useState } from 'react';
import { useAppSelector } from '../../app/hooks';
import { selectPattern } from '../pattern/selectors';
import { saveSession } from './storage';

const DEBOUNCE_MS = 300;

/**
 * Persists the working pattern so a reload does not lose it.
 *
 * Debounced because sliders fire continuously and localStorage writes are
 * synchronous — writing on every pixel of a drag would stall the main thread.
 */
export function useAutosave(): string | null {
  const pattern = useAppSelector(selectPattern);
  const timerRef = useRef<number | undefined>(undefined);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    window.clearTimeout(timerRef.current);

    timerRef.current = window.setTimeout(() => {
      const result = saveSession(pattern);
      setProblem(
        result.ok || result.reason !== 'quota'
          ? null
          : 'Browser storage is full, so your work is no longer being saved automatically.',
      );
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timerRef.current);
    };
  }, [pattern]);

  return problem;
}
