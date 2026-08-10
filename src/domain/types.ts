import type { Color } from './color';
import type { Length, PxLength } from './length';

/** Bump on any breaking shape change, and write a migration in features/share. */
export const SCHEMA_VERSION = 1;

export type GradientStop = {
  color: Color;
  /** Offset along the gradient line, in px or %. */
  position: Length;
};

export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

export const BLEND_MODES: readonly BlendMode[] = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'darken',
  'lighten',
  'color-dodge',
  'color-burn',
  'hard-light',
  'soft-light',
  'difference',
  'exclusion',
  'hue',
  'saturation',
  'color',
  'luminosity',
];

export type RepeatMode = 'repeat' | 'no-repeat' | 'repeat-x' | 'repeat-y' | 'space' | 'round';

export const REPEAT_MODES: readonly RepeatMode[] = [
  'repeat',
  'no-repeat',
  'repeat-x',
  'repeat-y',
  'space',
  'round',
];

export type LayerSize =
  | { kind: 'auto' }
  | { kind: 'cover' }
  | { kind: 'contain' }
  /** Either axis may be a length or `auto`, matching CSS `background-size: auto 40px`. */
  | { kind: 'custom'; width: Length | 'auto'; height: Length | 'auto' };

/** Matches CSS background-position; negatives are legal and useful. */
export type LayerPosition = { x: Length; y: Length };

/**
 * Colour space used to interpolate between stops. sRGB is the CSS default;
 * oklch keeps midpoints vivid but is newer syntax — see the browser baseline note.
 */
export type Interpolation = 'srgb' | 'oklch';

export type RadialShape = 'circle' | 'ellipse';

export type RadialExtent = 'closest-side' | 'closest-corner' | 'farthest-side' | 'farthest-corner';

export const RADIAL_EXTENTS: readonly RadialExtent[] = [
  'closest-side',
  'closest-corner',
  'farthest-side',
  'farthest-corner',
];

/**
 * CSS is fussy here: `circle 50px` is valid but `circle 50%` is not — only
 * ellipses accept percentages. The union encodes that so it cannot be got wrong.
 */
export type RadialSize =
  | { kind: 'extent'; extent: RadialExtent }
  | { kind: 'circle'; radius: PxLength }
  | { kind: 'ellipse'; x: Length; y: Length };

type LayerBase = {
  id: string;
  name: string;
  visible: boolean;
  blendMode: BlendMode;
  size: LayerSize;
  position: LayerPosition;
  repeat: RepeatMode;
};

/**
 * CSS has no per-layer background opacity, so this is baked into stop alphas
 * at generation time rather than emitted as a declaration.
 */
type Fadeable = { opacity: number };

type GradientBase = LayerBase & Fadeable & { stops: GradientStop[]; interpolation: Interpolation };

export type LinearGradientLayer = GradientBase & {
  kind: 'linear-gradient' | 'repeating-linear-gradient';
  angle: number;
};

export type RadialGradientLayer = GradientBase & {
  kind: 'radial-gradient' | 'repeating-radial-gradient';
  shape: RadialShape;
  radialSize: RadialSize;
  center: LayerPosition;
};

export type ConicGradientLayer = GradientBase & {
  kind: 'conic-gradient' | 'repeating-conic-gradient';
  fromAngle: number;
  center: LayerPosition;
};

export type SolidLayer = LayerBase & Fadeable & { kind: 'solid'; color: Color };

export type ImageLayer = LayerBase & { kind: 'image'; url: string };

export type Layer =
  LinearGradientLayer | RadialGradientLayer | ConicGradientLayer | SolidLayer | ImageLayer;

export type LayerKind = Layer['kind'];

export const LAYER_KINDS: readonly LayerKind[] = [
  'linear-gradient',
  'repeating-linear-gradient',
  'radial-gradient',
  'repeating-radial-gradient',
  'conic-gradient',
  'repeating-conic-gradient',
  'solid',
  'image',
];

/*
  Repeating is a property of a gradient, not a separate kind of layer, so it is
  not offered at creation — you pick a gradient and then decide whether its
  stops repeat. `LAYER_KINDS` still lists every kind, because the URL decoder
  and the CSS generator have to handle all of them however a layer got here.
*/
export const CREATABLE_KINDS: readonly LayerKind[] = [
  'linear-gradient',
  'radial-gradient',
  'conic-gradient',
  'solid',
  'image',
];

/**
 * The repeating counterpart of each gradient kind.
 *
 * Note this is a different concept from `background-repeat`, which tiles the
 * whole image: `repeating-linear-gradient()` repeats the colour stops within a
 * single tile. The two compose independently, and conflating them would cost
 * the ability to make stripes at all.
 */
const REPEATING_PAIRS: Readonly<Record<string, LayerKind>> = {
  'linear-gradient': 'repeating-linear-gradient',
  'repeating-linear-gradient': 'linear-gradient',
  'radial-gradient': 'repeating-radial-gradient',
  'repeating-radial-gradient': 'radial-gradient',
  'conic-gradient': 'repeating-conic-gradient',
  'repeating-conic-gradient': 'conic-gradient',
};

export function isRepeatingKind(kind: LayerKind): boolean {
  return kind.startsWith('repeating-');
}

/** The same gradient with its stop repetition flipped, or null if not a gradient. */
export function toggleRepeatingKind(kind: LayerKind): LayerKind | null {
  return REPEATING_PAIRS[kind] ?? null;
}

export type Canvas = {
  width: number;
  height: number;
  baseColor: Color;
};

export type Pattern = {
  v: number;
  /** Index 0 paints on top — matches CSS background layer order. */
  layers: Layer[];
  canvas: Canvas;
};

export function isGradientLayer(
  layer: Layer,
): layer is LinearGradientLayer | RadialGradientLayer | ConicGradientLayer {
  switch (layer.kind) {
    case 'linear-gradient':
    case 'repeating-linear-gradient':
    case 'radial-gradient':
    case 'repeating-radial-gradient':
    case 'conic-gradient':
    case 'repeating-conic-gradient':
      return true;
    case 'solid':
    case 'image':
      return false;
  }
}
