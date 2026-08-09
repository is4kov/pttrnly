import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

/**
 * jsdom gaps and non-determinism, stubbed once here.
 * See CLAUDE.md → "Test environment gotchas".
 */

// matchMedia is unimplemented in jsdom; anything reading prefers-color-scheme
// or prefers-reduced-motion needs it.
let mediaMatches = false;

export function setMediaMatches(value: boolean): void {
  mediaMatches = value;
}

// crypto.randomUUID would make layer ids non-deterministic across runs.
let uuidCounter = 0;

export function resetUuidCounter(): void {
  uuidCounter = 0;
}

beforeEach(() => {
  mediaMatches = false;
  resetUuidCounter();

  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: mediaMatches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );

  vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
    uuidCounter += 1;
    return `00000000-0000-4000-8000-${String(uuidCounter).padStart(12, '0')}`;
  });

  // jsdom implements no pointer capture, so any component using it would throw
  // on mount or interaction. Real drag behaviour is covered in Playwright.
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn(() => false);

  /*
    jsdom 26 ships HTMLDialogElement but none of its methods, so a native
    <dialog> throws the moment it is opened. This stub only tracks the `open`
    attribute and fires `close` — there is no top layer, no `inert`, and no
    focus trap in jsdom, so modal focus behaviour is Playwright's job.
  */
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.show = function show(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };

  // jsdom has no real clipboard. Verify actual copy behaviour in Playwright.
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
