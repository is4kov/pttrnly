import { parsePattern } from '../../domain/parse';
import type { Color } from '../../domain/color';
import type { Length } from '../../domain/length';
import { SCHEMA_VERSION, type Layer, type LayerSize, type Pattern } from '../../domain/types';

/**
 * Turns a pattern into something short enough to paste.
 *
 * The stored shape is verbose by design — readable field names, nested objects.
 * A URL wants the opposite, so patterns go over the wire as short-keyed arrays,
 * typically four to five times smaller than the JSON before base64 inflates it
 * by a further third.
 *
 * Decoding never trusts what it finds: the wire format is expanded back into the
 * ordinary shape and then run through parsePattern, which does the real
 * validation. This file only has to be reversible, not safe.
 */

/** Bump alongside SCHEMA_VERSION when the wire shape changes. */
const WIRE_VERSION = 1;

type WireColor = [l: number, c: number, h: number, alpha: number];
type WireLength = [value: number, unit: 0 | 1];
type WireSize = 0 | 1 | 2 | [width: WireLength | 0, height: WireLength | 0];

const round = (value: number, places: number): number => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};

/* -------------------------------------------------------------------------- */
/* Encoding                                                                    */
/* -------------------------------------------------------------------------- */

// Colour components are rounded to the precision the generator actually emits.
const colorOut = (color: Color): WireColor => [
  round(color.l, 4),
  round(color.c, 4),
  round(color.h, 2),
  round(color.alpha, 3),
];

const lengthOut = (length: Length): WireLength => [
  round(length.value, 2),
  length.unit === 'px' ? 0 : 1,
];

function sizeOut(size: LayerSize): WireSize {
  switch (size.kind) {
    case 'auto':
      return 0;
    case 'cover':
      return 1;
    case 'contain':
      return 2;
    case 'custom':
      return [
        size.width === 'auto' ? 0 : lengthOut(size.width),
        size.height === 'auto' ? 0 : lengthOut(size.height),
      ];
  }
}

function layerOut(layer: Layer): unknown[] {
  const head = [
    layer.kind,
    layer.id,
    layer.name,
    layer.visible ? 1 : 0,
    layer.blendMode,
    sizeOut(layer.size),
    [lengthOut(layer.position.x), lengthOut(layer.position.y)],
    layer.repeat,
  ];

  switch (layer.kind) {
    case 'image':
      return [...head, layer.url];

    case 'solid':
      return [...head, round(layer.opacity, 3), colorOut(layer.color)];

    case 'linear-gradient':
    case 'repeating-linear-gradient':
      return [...head, ...gradientOut(layer), round(layer.angle, 2)];

    case 'conic-gradient':
    case 'repeating-conic-gradient':
      return [
        ...head,
        ...gradientOut(layer),
        round(layer.fromAngle, 2),
        [lengthOut(layer.center.x), lengthOut(layer.center.y)],
      ];

    case 'radial-gradient':
    case 'repeating-radial-gradient': {
      const radial = layer.radialSize;
      const size =
        radial.kind === 'extent'
          ? [0, radial.extent]
          : radial.kind === 'circle'
            ? [1, lengthOut(radial.radius)]
            : [2, lengthOut(radial.x), lengthOut(radial.y)];

      return [
        ...head,
        ...gradientOut(layer),
        layer.shape,
        size,
        [lengthOut(layer.center.x), lengthOut(layer.center.y)],
      ];
    }
  }
}

/** The three fields every gradient kind shares, in wire order. */
function gradientOut(layer: {
  opacity: number;
  interpolation: string;
  stops: readonly { color: Color; position: Length }[];
}): unknown[] {
  return [
    round(layer.opacity, 3),
    layer.interpolation,
    layer.stops.map((stop) => [colorOut(stop.color), lengthOut(stop.position)]),
  ];
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function encodePattern(pattern: Pattern): string {
  const wire = [
    WIRE_VERSION,
    pattern.layers.map(layerOut),
    [pattern.canvas.width, pattern.canvas.height, colorOut(pattern.canvas.baseColor)],
  ];

  return toBase64Url(JSON.stringify(wire));
}

/* -------------------------------------------------------------------------- */
/* Decoding                                                                    */
/* -------------------------------------------------------------------------- */

const isArray = (value: unknown): value is unknown[] => Array.isArray(value);

function colorIn(value: unknown): unknown {
  if (!isArray(value) || value.length !== 4) return null;
  return { l: value[0], c: value[1], h: value[2], alpha: value[3] };
}

function lengthIn(value: unknown): unknown {
  if (!isArray(value) || value.length !== 2) return null;
  return { value: value[0], unit: value[1] === 0 ? 'px' : '%' };
}

function sizeIn(value: unknown): unknown {
  if (value === 0) return { kind: 'auto' };
  if (value === 1) return { kind: 'cover' };
  if (value === 2) return { kind: 'contain' };
  if (!isArray(value) || value.length !== 2) return null;

  return {
    kind: 'custom',
    width: value[0] === 0 ? 'auto' : lengthIn(value[0]),
    height: value[1] === 0 ? 'auto' : lengthIn(value[1]),
  };
}

function positionIn(value: unknown): unknown {
  if (!isArray(value) || value.length !== 2) return null;
  return { x: lengthIn(value[0]), y: lengthIn(value[1]) };
}

function radialSizeIn(value: unknown): unknown {
  if (!isArray(value)) return null;
  if (value[0] === 0) return { kind: 'extent', extent: value[1] };
  if (value[0] === 1) return { kind: 'circle', radius: lengthIn(value[1]) };
  return { kind: 'ellipse', x: lengthIn(value[1]), y: lengthIn(value[2]) };
}

/** Expands the wire shape. Anything malformed becomes something parsePattern rejects. */
function layerIn(value: unknown): unknown {
  if (!isArray(value) || value.length < 8) return null;

  const [kind, id, name, visible, blendMode, size, position, repeat] = value;
  const base = {
    kind,
    id,
    name,
    visible: visible === 1,
    blendMode,
    size: sizeIn(size),
    position: positionIn(position),
    repeat,
  };

  if (kind === 'image') return { ...base, url: value[8] };
  if (kind === 'solid') return { ...base, opacity: value[8], color: colorIn(value[9]) };

  const stops = isArray(value[10])
    ? value[10].map((entry) =>
        isArray(entry) ? { color: colorIn(entry[0]), position: lengthIn(entry[1]) } : null,
      )
    : null;

  const gradient = { ...base, opacity: value[8], interpolation: value[9], stops };

  if (kind === 'linear-gradient' || kind === 'repeating-linear-gradient') {
    return { ...gradient, angle: value[11] };
  }

  if (kind === 'conic-gradient' || kind === 'repeating-conic-gradient') {
    return { ...gradient, fromAngle: value[11], center: positionIn(value[12]) };
  }

  return {
    ...gradient,
    shape: value[11],
    radialSize: radialSizeIn(value[12]),
    center: positionIn(value[13]),
  };
}

function fromBase64Url(encoded: string): string | null {
  const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');

  try {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Returns null for anything that is not a pattern this build understands —
 * bad base64, bad JSON, an unknown wire version, or a shape parsePattern
 * refuses. Callers show an explicit error rather than a blank canvas.
 */
export function decodePattern(encoded: string): Pattern | null {
  const json = fromBase64Url(encoded);
  if (json === null) return null;

  let wire: unknown;
  try {
    wire = JSON.parse(json);
  } catch {
    return null;
  }

  if (!isArray(wire) || wire.length !== 3) return null;
  if (wire[0] !== WIRE_VERSION) return null;
  if (!isArray(wire[1]) || !isArray(wire[2])) return null;

  const [width, height, baseColor] = wire[2];

  // Expanded, then validated properly. This function is only responsible for
  // being reversible; parsePattern is responsible for being safe.
  return parsePattern({
    v: SCHEMA_VERSION,
    layers: wire[1].map(layerIn),
    canvas: { width, height, baseColor: colorIn(baseColor) },
  });
}
