import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import type { Pattern } from '../../domain/types';
import { patternLoaded } from '../pattern/patternSlice';
import { selectPattern } from '../pattern/selectors';
import { loadSession } from '../persistence/storage';
import { decodePattern, encodePattern } from './codec';

const HASH_PREFIX = '#p=';
const SYNC_DEBOUNCE_MS = 300;

export type IncomingLink =
  { kind: 'none' } | { kind: 'invalid' } | { kind: 'loaded'; displacedSession: Pattern | null };

function readHash(): string | null {
  const hash = window.location.hash;
  return hash.startsWith(HASH_PREFIX) ? hash.slice(HASH_PREFIX.length) : null;
}

/** The payload lives in the hash, which browsers never send to a server. */
export function shareUrlFor(pattern: Pattern): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}${HASH_PREFIX}${encodePattern(pattern)}`;
}

/**
 * Reads an incoming share link once on mount and keeps the URL in step with
 * the pattern thereafter.
 *
 * Precedence follows CLAUDE.md: a pattern in the URL wins, but autosaved work
 * is never silently discarded — it is handed back so the user can return to it.
 */
export function useShareLink(): IncomingLink {
  const dispatch = useAppDispatch();
  const pattern = useAppSelector(selectPattern);
  const timerRef = useRef<number | undefined>(undefined);
  const [incoming, setIncoming] = useState<IncomingLink>({ kind: 'none' });

  // Read once. Later hash changes come from our own syncing.
  useEffect(() => {
    const encoded = readHash();
    if (encoded === null) return;

    const shared = decodePattern(encoded);
    if (!shared) {
      setIncoming({ kind: 'invalid' });
      return;
    }

    // Captured before the link overwrites the working pattern, so nothing is lost.
    const session = loadSession();
    const displaced =
      session && JSON.stringify(session) !== JSON.stringify(shared) ? session : null;

    dispatch(patternLoaded(shared));
    setIncoming({ kind: 'loaded', displacedSession: displaced });
  }, [dispatch]);

  // replaceState, never pushState: one history entry per slider tick would make
  // the back button useless.
  useEffect(() => {
    window.clearTimeout(timerRef.current);

    timerRef.current = window.setTimeout(() => {
      const { origin, pathname, search } = window.location;
      window.history.replaceState(
        null,
        '',
        `${origin}${pathname}${search}${HASH_PREFIX}${encodePattern(pattern)}`,
      );
    }, SYNC_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timerRef.current);
    };
  }, [pattern]);

  return incoming;
}

/** The share URL for the current pattern, recomputed only when it changes. */
export function useShareUrl(): string {
  const pattern = useAppSelector(selectPattern);
  return useMemo(() => shareUrlFor(pattern), [pattern]);
}
