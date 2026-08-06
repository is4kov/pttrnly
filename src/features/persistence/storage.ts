import { parsePattern } from '../../domain/parse';
import { SCHEMA_VERSION, type Pattern } from '../../domain/types';

/**
 * localStorage is small, shared, and editable by hand. Everything read back
 * goes through the validating parser; nothing here trusts what it finds.
 */

const AUTOSAVE_KEY = 'pttrnly:session';
const LIBRARY_KEY = 'pttrnly:patterns';

export const MAX_SAVED_PATTERNS = 50;

export type SavedPattern = {
  id: string;
  name: string;
  savedAt: number;
  pattern: Pattern;
};

export type StorageResult = { ok: true } | { ok: false; reason: 'quota' | 'unavailable' };

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    // Blocked by privacy settings, or running somewhere without it.
    return null;
  }
}

function write(key: string, value: string): StorageResult {
  const store = storage();
  if (!store) return { ok: false, reason: 'unavailable' };

  try {
    store.setItem(key, value);
    return { ok: true };
  } catch (error) {
    // A failed write must never leave a half-written or dropped list behind,
    // so nothing is removed on failure — the previous value stands.
    const quotaExceeded =
      error instanceof DOMException &&
      (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED');

    return { ok: false, reason: quotaExceeded ? 'quota' : 'unavailable' };
  }
}

function read(key: string): string | null {
  const store = storage();
  if (!store) return null;

  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* Working session                                                             */
/* -------------------------------------------------------------------------- */

export function saveSession(pattern: Pattern): StorageResult {
  return write(AUTOSAVE_KEY, JSON.stringify(pattern));
}

export function loadSession(): Pattern | null {
  const raw = read(AUTOSAVE_KEY);
  if (!raw) return null;

  try {
    return parsePattern(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function clearSession(): void {
  storage()?.removeItem(AUTOSAVE_KEY);
}

/* -------------------------------------------------------------------------- */
/* Saved library                                                               */
/* -------------------------------------------------------------------------- */

/** Entries that fail validation are dropped rather than failing the whole list. */
export function loadLibrary(): SavedPattern[] {
  const raw = read(LIBRARY_KEY);
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  const saved: SavedPattern[] = [];

  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) continue;

    const candidate = entry as Record<string, unknown>;
    if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string') continue;
    if (typeof candidate.savedAt !== 'number') continue;

    const pattern = parsePattern(candidate.pattern);
    if (!pattern) continue;

    saved.push({ id: candidate.id, name: candidate.name, savedAt: candidate.savedAt, pattern });
  }

  return saved;
}

export function saveLibrary(patterns: readonly SavedPattern[]): StorageResult {
  return write(LIBRARY_KEY, JSON.stringify(patterns));
}

export const emptyPattern = (baseColor: Pattern['canvas']['baseColor']): Pattern => ({
  v: SCHEMA_VERSION,
  layers: [],
  canvas: { width: 800, height: 500, baseColor },
});
