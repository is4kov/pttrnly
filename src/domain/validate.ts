/**
 * Guards for values that reach the generated CSS.
 * Patterns can arrive from share links, which are untrusted input — see CLAUDE.md "Security".
 */

export const LIMITS = {
  canvasSize: { min: 1, max: 10_000 },
  /** Percentages for size, position and stop offsets. */
  percent: { min: -1000, max: 1000 },
  /** Pixel lengths. Bounded so a hostile share link cannot render a 900000px layer. */
  px: { min: -10_000, max: 10_000 },
  angle: { min: -3600, max: 3600 },
  opacity: { min: 0, max: 1 },
  /** CSS needs two stops for a valid gradient; the cap is our own guard. */
  stopsPerLayer: { min: 2, max: 64 },
  layersPerPattern: { min: 0, max: 200 },
  urlLength: { max: 4096 },
} as const;

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return value < min ? min : value > max ? max : value;
}

/**
 * Characters that could terminate a url() token or escape the declaration.
 * Rejected outright rather than escaped — sanitising quoting rules is easy to get subtly wrong.
 */
function hasForbiddenUrlChars(url: string): boolean {
  for (const char of url) {
    const code = char.codePointAt(0) ?? 0;
    if (code <= 0x20 || code === 0x7f) return true;
    if (char === '"' || char === "'" || char === '(' || char === ')' || char === '\\') return true;
  }
  return false;
}

const ALLOWED_PROTOCOLS: readonly string[] = ['https:'];

const DATA_IMAGE_PATTERN =
  /^data:image\/(?:png|jpeg|gif|webp|avif|svg\+xml);base64,[A-Za-z0-9+/]+={0,2}$/;

/**
 * Image layer URLs are allowlisted to https: and data:image/*.
 * Everything else — javascript:, blob:, relative paths — is rejected.
 */
export function isAllowedImageUrl(url: string): boolean {
  if (url.length === 0 || url.length > LIMITS.urlLength.max) return false;
  if (hasForbiddenUrlChars(url)) return false;

  if (url.toLowerCase().startsWith('data:')) return DATA_IMAGE_PATTERN.test(url);

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  return ALLOWED_PROTOCOLS.includes(parsed.protocol);
}
