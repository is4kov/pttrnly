/**
 * The canonical colour representation for the whole app is OKLCH.
 * Conversions live here and nowhere else — see CLAUDE.md "Color model".
 */

export type Color = {
  /** Perceptual lightness, 0–1. */
  l: number;
  /** Chroma, 0 to roughly 0.4. */
  c: number;
  /** Hue in degrees, 0–360. */
  h: number;
  /** 0–1. */
  alpha: number;
};

export type ColorFormat = 'oklch' | 'hex' | 'rgb' | 'hsl';

export const COLOR_FORMATS: readonly ColorFormat[] = ['oklch', 'hex', 'rgb', 'hsl'];

type LinearRgb = { r: number; g: number; b: number };

const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

export function makeColor(l: number, c: number, h: number, alpha = 1): Color {
  return {
    l: clamp(l, 0, 1),
    c: clamp(c, 0, 0.5),
    h: ((h % 360) + 360) % 360,
    alpha: clamp(alpha, 0, 1),
  };
}

/* -------------------------------------------------------------------------- */
/* OKLCH → linear sRGB                                                         */
/* -------------------------------------------------------------------------- */

function oklchToLinearRgb(color: Color): LinearRgb {
  const hRad = (color.h * Math.PI) / 180;
  const a = color.c * Math.cos(hRad);
  const b = color.c * Math.sin(hRad);

  const lCbrt = color.l + 0.3963377774 * a + 0.2158037573 * b;
  const mCbrt = color.l - 0.1055613458 * a - 0.0638541728 * b;
  const sCbrt = color.l - 0.0894841775 * a - 1.291485548 * b;

  const lLms = lCbrt ** 3;
  const mLms = mCbrt ** 3;
  const sLms = sCbrt ** 3;

  return {
    r: 4.0767416621 * lLms - 3.3077115913 * mLms + 0.2309699292 * sLms,
    g: -1.2684380046 * lLms + 2.6097574011 * mLms - 0.3413193965 * sLms,
    b: -0.0041960863 * lLms - 0.7034186147 * mLms + 1.707614701 * sLms,
  };
}

function linearRgbToOklch(rgb: LinearRgb, alpha: number): Color {
  const lLms = 0.4122214708 * rgb.r + 0.5363325363 * rgb.g + 0.0514459929 * rgb.b;
  const mLms = 0.2119034982 * rgb.r + 0.6806995451 * rgb.g + 0.1073969566 * rgb.b;
  const sLms = 0.0883024619 * rgb.r + 0.2817188376 * rgb.g + 0.6299787005 * rgb.b;

  const lCbrt = Math.cbrt(lLms);
  const mCbrt = Math.cbrt(mLms);
  const sCbrt = Math.cbrt(sLms);

  const l = 0.2104542553 * lCbrt + 0.793617785 * mCbrt - 0.0040720468 * sCbrt;
  const a = 1.9779984951 * lCbrt - 2.428592205 * mCbrt + 0.4505937099 * sCbrt;
  const b = 0.0259040371 * lCbrt + 0.7827717662 * mCbrt - 0.808675766 * sCbrt;

  const c = Math.sqrt(a * a + b * b);
  const h = c < 1e-6 ? 0 : (Math.atan2(b, a) * 180) / Math.PI;

  return makeColor(l, c, h, alpha);
}

const gammaEncode = (channel: number): number =>
  channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055;

const gammaDecode = (channel: number): number =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

/* -------------------------------------------------------------------------- */
/* Gamut mapping                                                               */
/* -------------------------------------------------------------------------- */

const IN_GAMUT_EPSILON = 1e-5;

function isInSrgbGamut(rgb: LinearRgb): boolean {
  return (
    rgb.r >= -IN_GAMUT_EPSILON &&
    rgb.r <= 1 + IN_GAMUT_EPSILON &&
    rgb.g >= -IN_GAMUT_EPSILON &&
    rgb.g <= 1 + IN_GAMUT_EPSILON &&
    rgb.b >= -IN_GAMUT_EPSILON &&
    rgb.b <= 1 + IN_GAMUT_EPSILON
  );
}

/** True when the colour cannot be shown exactly in sRGB, so hex/rgb/hsl output will alter it. */
export function isOutOfSrgbGamut(color: Color): boolean {
  return !isInSrgbGamut(oklchToLinearRgb(color));
}

/**
 * Reduce chroma until the colour fits sRGB, preserving lightness and hue.
 * Naive per-channel clamping shifts hue, which is exactly what users notice.
 */
export function gamutMapToSrgb(color: Color): Color {
  if (!isOutOfSrgbGamut(color)) return color;

  let low = 0;
  let high = color.c;

  for (let i = 0; i < 24; i += 1) {
    const mid = (low + high) / 2;
    if (isInSrgbGamut(oklchToLinearRgb({ ...color, c: mid }))) {
      low = mid;
    } else {
      high = mid;
    }
  }

  return { ...color, c: low };
}

/* -------------------------------------------------------------------------- */
/* Serialisation                                                               */
/* -------------------------------------------------------------------------- */

/** Fixed-precision, trailing zeros trimmed, no "-0". Output must be byte-stable. */
export function formatNumber(value: number, precision: number): string {
  const rounded = Number(value.toFixed(precision));
  const normalised = Object.is(rounded, -0) ? 0 : rounded;
  return String(normalised);
}

type Rgb255 = { r: number; g: number; b: number };

function toRgb255(color: Color): Rgb255 {
  const linear = oklchToLinearRgb(gamutMapToSrgb(color));
  return {
    r: Math.round(clamp(gammaEncode(linear.r), 0, 1) * 255),
    g: Math.round(clamp(gammaEncode(linear.g), 0, 1) * 255),
    b: Math.round(clamp(gammaEncode(linear.b), 0, 1) * 255),
  };
}

function formatAlpha(alpha: number): string {
  return formatNumber(alpha, 3);
}

function toHex(color: Color): string {
  const { r, g, b } = toRgb255(color);
  const pair = (value: number): string => value.toString(16).padStart(2, '0');
  const base = `#${pair(r)}${pair(g)}${pair(b)}`;
  if (color.alpha >= 1) return base;
  return `${base}${pair(Math.round(color.alpha * 255))}`;
}

function toRgbString(color: Color): string {
  const { r, g, b } = toRgb255(color);
  const channels = `${String(r)} ${String(g)} ${String(b)}`;
  return color.alpha >= 1 ? `rgb(${channels})` : `rgb(${channels} / ${formatAlpha(color.alpha)})`;
}

function toHslString(color: Color): string {
  const { r, g, b } = toRgb255(color);
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;
  const lightness = (max + min) / 2;

  let hue = 0;
  if (delta > 0) {
    if (max === rNorm) hue = ((gNorm - bNorm) / delta) % 6;
    else if (max === gNorm) hue = (bNorm - rNorm) / delta + 2;
    else hue = (rNorm - gNorm) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }

  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  const parts = `${formatNumber(hue, 1)} ${formatNumber(saturation * 100, 1)}% ${formatNumber(lightness * 100, 1)}%`;

  return color.alpha >= 1 ? `hsl(${parts})` : `hsl(${parts} / ${formatAlpha(color.alpha)})`;
}

function toOklchString(color: Color): string {
  const parts = `${formatNumber(color.l * 100, 2)}% ${formatNumber(color.c, 4)} ${formatNumber(color.h, 2)}`;
  return color.alpha >= 1 ? `oklch(${parts})` : `oklch(${parts} / ${formatAlpha(color.alpha)})`;
}

export function serializeColor(color: Color, format: ColorFormat): string {
  switch (format) {
    case 'oklch':
      return toOklchString(color);
    case 'hex':
      return toHex(color);
    case 'rgb':
      return toRgbString(color);
    case 'hsl':
      return toHslString(color);
  }
}

/* -------------------------------------------------------------------------- */
/* Parsing                                                                     */
/* -------------------------------------------------------------------------- */

const HEX_PATTERN = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function expandShorthand(hex: string): string {
  if (hex.length > 5) return hex;
  return `#${hex.slice(1).replace(/./g, (char) => `${char}${char}`)}`;
}

/** Parses #rgb, #rgba, #rrggbb and #rrggbbaa. Returns null rather than throwing. */
export function parseHex(input: string): Color | null {
  const trimmed = input.trim();
  if (!HEX_PATTERN.test(trimmed)) return null;

  const hex = expandShorthand(trimmed);
  const channel = (start: number): number => parseInt(hex.slice(start, start + 2), 16) / 255;

  const alpha = hex.length === 9 ? channel(7) : 1;

  return linearRgbToOklch(
    {
      r: gammaDecode(channel(1)),
      g: gammaDecode(channel(3)),
      b: gammaDecode(channel(5)),
    },
    alpha,
  );
}

/** Multiplies a colour's alpha, used to apply layer opacity at serialisation time. */
export function withAlphaScale(color: Color, scale: number): Color {
  return { ...color, alpha: clamp(color.alpha * scale, 0, 1) };
}
