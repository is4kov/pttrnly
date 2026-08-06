import { makeColor, type Color } from './color';
import type { Length, LengthUnit, PxLength } from './length';
import { clampNumber, isAllowedImageUrl, LIMITS } from './validate';
import {
  BLEND_MODES,
  LAYER_KINDS,
  RADIAL_EXTENTS,
  REPEAT_MODES,
  SCHEMA_VERSION,
  type BlendMode,
  type Canvas,
  type GradientStop,
  type Interpolation,
  type Layer,
  type LayerKind,
  type LayerPosition,
  type LayerSize,
  type Pattern,
  type RadialExtent,
  type RadialShape,
  type RadialSize,
  type RepeatMode,
} from './types';
import { MAX_STOPS, MIN_STOPS } from './stops';

/**
 * Parses untrusted data into a Pattern.
 *
 * Everything here checks types, ranges and enum membership explicitly — a cast
 * would let a stranger's share link or a corrupted localStorage entry put
 * arbitrary values into a style block. See CLAUDE.md "Security".
 *
 * Returns null rather than throwing, so callers can show an explicit error
 * state instead of a blank canvas.
 */

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (typeof value !== 'string') return null;
  return allowed.includes(value as T) ? (value as T) : null;
}

function parseColor(value: unknown): Color | null {
  if (!isObject(value)) return null;
  if (!isFiniteNumber(value.l) || !isFiniteNumber(value.c)) return null;
  if (!isFiniteNumber(value.h) || !isFiniteNumber(value.alpha)) return null;

  // makeColor clamps, so out-of-range numbers are corrected rather than rejected.
  return makeColor(value.l, value.c, value.h, value.alpha);
}

function parseLength(value: unknown): Length | null {
  if (!isObject(value)) return null;
  if (!isFiniteNumber(value.value)) return null;

  const unit = oneOf<LengthUnit>(value.unit, ['px', '%']);
  if (!unit) return null;

  const limit = unit === 'px' ? LIMITS.px : LIMITS.percent;
  return { value: clampNumber(value.value, limit.min, limit.max), unit };
}

function parsePxLength(value: unknown): PxLength | null {
  const length = parseLength(value);
  if (!length || length.unit !== 'px') return null;
  return { value: length.value, unit: 'px' };
}

function parsePosition(value: unknown): LayerPosition | null {
  if (!isObject(value)) return null;

  const x = parseLength(value.x);
  const y = parseLength(value.y);
  if (!x || !y) return null;

  return { x, y };
}

function parseSize(value: unknown): LayerSize | null {
  if (!isObject(value)) return null;

  const kind = oneOf(value.kind, ['auto', 'cover', 'contain', 'custom'] as const);
  if (!kind) return null;
  if (kind !== 'custom') return { kind };

  const axis = (input: unknown): Length | 'auto' | null => {
    if (input === 'auto') return 'auto';
    return parseLength(input);
  };

  const width = axis(value.width);
  const height = axis(value.height);
  if (!width || !height) return null;

  return { kind: 'custom', width, height };
}

function parseRadialSize(value: unknown): RadialSize | null {
  if (!isObject(value)) return null;

  const kind = oneOf(value.kind, ['extent', 'circle', 'ellipse'] as const);
  if (!kind) return null;

  if (kind === 'extent') {
    const extent = oneOf<RadialExtent>(value.extent, RADIAL_EXTENTS);
    return extent ? { kind, extent } : null;
  }

  if (kind === 'circle') {
    // CSS refuses a percentage radius on a circle, so the parser must too.
    const radius = parsePxLength(value.radius);
    return radius ? { kind, radius } : null;
  }

  const x = parseLength(value.x);
  const y = parseLength(value.y);
  return x && y ? { kind, x, y } : null;
}

function parseStops(value: unknown): GradientStop[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length < MIN_STOPS || value.length > MAX_STOPS) return null;

  const stops: GradientStop[] = [];

  for (const entry of value) {
    if (!isObject(entry)) return null;

    const color = parseColor(entry.color);
    const position = parseLength(entry.position);
    if (!color || !position) return null;

    stops.push({ color, position });
  }

  return stops;
}

type LayerBase = {
  id: string;
  name: string;
  visible: boolean;
  blendMode: BlendMode;
  size: LayerSize;
  position: LayerPosition;
  repeat: RepeatMode;
};

function parseLayerBase(value: Json): LayerBase | null {
  if (typeof value.id !== 'string' || value.id.length === 0) return null;
  if (typeof value.name !== 'string') return null;
  if (typeof value.visible !== 'boolean') return null;

  const blendMode = oneOf<BlendMode>(value.blendMode, BLEND_MODES);
  const repeat = oneOf<RepeatMode>(value.repeat, REPEAT_MODES);
  const size = parseSize(value.size);
  const position = parsePosition(value.position);

  if (!blendMode || !repeat || !size || !position) return null;

  return {
    id: value.id,
    name: value.name,
    visible: value.visible,
    blendMode,
    size,
    position,
    repeat,
  };
}

const parseOpacity = (value: unknown): number | null =>
  isFiniteNumber(value) ? clampNumber(value, LIMITS.opacity.min, LIMITS.opacity.max) : null;

const parseAngle = (value: unknown): number | null =>
  isFiniteNumber(value) ? clampNumber(value, LIMITS.angle.min, LIMITS.angle.max) : null;

function parseLayer(value: unknown): Layer | null {
  if (!isObject(value)) return null;

  const kind = oneOf<LayerKind>(value.kind, LAYER_KINDS);
  if (!kind) return null;

  const base = parseLayerBase(value);
  if (!base) return null;

  if (kind === 'image') {
    if (typeof value.url !== 'string') return null;
    // An empty URL is a layer mid-edit; anything non-empty must pass the allowlist.
    if (value.url.length > 0 && !isAllowedImageUrl(value.url)) return null;
    return { ...base, kind, url: value.url };
  }

  const opacity = parseOpacity(value.opacity);
  if (opacity === null) return null;

  if (kind === 'solid') {
    const color = parseColor(value.color);
    return color ? { ...base, kind, opacity, color } : null;
  }

  const stops = parseStops(value.stops);
  const interpolation = oneOf<Interpolation>(value.interpolation, ['srgb', 'oklch']);
  if (!stops || !interpolation) return null;

  const gradient = { ...base, opacity, stops, interpolation };

  switch (kind) {
    case 'linear-gradient':
    case 'repeating-linear-gradient': {
      const angle = parseAngle(value.angle);
      return angle === null ? null : { ...gradient, kind, angle };
    }

    case 'radial-gradient':
    case 'repeating-radial-gradient': {
      const shape = oneOf<RadialShape>(value.shape, ['circle', 'ellipse']);
      const radialSize = parseRadialSize(value.radialSize);
      const center = parsePosition(value.center);
      return shape && radialSize && center
        ? { ...gradient, kind, shape, radialSize, center }
        : null;
    }

    case 'conic-gradient':
    case 'repeating-conic-gradient': {
      const fromAngle = parseAngle(value.fromAngle);
      const center = parsePosition(value.center);
      return fromAngle === null || !center ? null : { ...gradient, kind, fromAngle, center };
    }
  }
}

function parseCanvas(value: unknown): Canvas | null {
  if (!isObject(value)) return null;
  if (!isFiniteNumber(value.width) || !isFiniteNumber(value.height)) return null;

  const baseColor = parseColor(value.baseColor);
  if (!baseColor) return null;

  const { min, max } = LIMITS.canvasSize;

  return {
    width: clampNumber(value.width, min, max),
    height: clampNumber(value.height, min, max),
    baseColor,
  };
}

export function parsePattern(value: unknown): Pattern | null {
  if (!isObject(value)) return null;

  // Only the current schema is understood. A future version bump needs a
  // migration here rather than a silent best-effort parse.
  if (value.v !== SCHEMA_VERSION) return null;

  if (!Array.isArray(value.layers)) return null;
  if (value.layers.length > LIMITS.layersPerPattern.max) return null;

  const canvas = parseCanvas(value.canvas);
  if (!canvas) return null;

  const layers: Layer[] = [];

  for (const entry of value.layers) {
    const layer = parseLayer(entry);
    if (!layer) return null;
    layers.push(layer);
  }

  return { v: SCHEMA_VERSION, layers, canvas };
}

/** Parses a JSON string, returning null for both bad JSON and bad shape. */
export function parsePatternJson(json: string): Pattern | null {
  try {
    return parsePattern(JSON.parse(json));
  } catch {
    return null;
  }
}
