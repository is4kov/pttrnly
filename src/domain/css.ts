import { serializeColor, withAlphaScale, formatNumber, type ColorFormat } from './color';
import { formatLength, formatNonNegativeLength } from './length';
import { clampNumber, isAllowedImageUrl, LIMITS } from './validate';
import type {
  ConicGradientLayer,
  GradientStop,
  Layer,
  LayerPosition,
  LayerSize,
  LinearGradientLayer,
  Pattern,
  RadialGradientLayer,
  RadialSize,
  SolidLayer,
} from './types';

export type OutputMode = 'longhand' | 'shorthand';

export type CssOptions = {
  mode: OutputMode;
  colorFormat: ColorFormat;
};

export const DEFAULT_CSS_OPTIONS: CssOptions = { mode: 'longhand', colorFormat: 'oklch' };

/* -------------------------------------------------------------------------- */
/* Value formatting                                                            */
/* -------------------------------------------------------------------------- */

const degrees = (value: number): string =>
  `${formatNumber(clampNumber(value, LIMITS.angle.min, LIMITS.angle.max), 2)}deg`;

/** Negative background-size is invalid CSS, so those lengths clamp at zero. */
function formatSize(size: LayerSize): string {
  switch (size.kind) {
    case 'auto':
      return 'auto';
    case 'cover':
      return 'cover';
    case 'contain':
      return 'contain';
    case 'custom': {
      const width = size.width === 'auto' ? 'auto' : formatNonNegativeLength(size.width);
      const height = size.height === 'auto' ? 'auto' : formatNonNegativeLength(size.height);
      return `${width} ${height}`;
    }
  }
}

const formatPosition = (position: LayerPosition): string =>
  `${formatLength(position.x)} ${formatLength(position.y)}`;

function formatRadialSize(size: RadialSize): string {
  switch (size.kind) {
    case 'extent':
      return size.extent;
    case 'circle':
      return formatNonNegativeLength(size.radius);
    case 'ellipse':
      return `${formatNonNegativeLength(size.x)} ${formatNonNegativeLength(size.y)}`;
  }
}

/* -------------------------------------------------------------------------- */
/* background-image per layer                                                  */
/* -------------------------------------------------------------------------- */

function formatStops(stops: readonly GradientStop[], opacity: number, format: ColorFormat): string {
  return stops
    .map(
      (stop) =>
        `${serializeColor(withAlphaScale(stop.color, opacity), format)} ${formatLength(stop.position)}`,
    )
    .join(', ');
}

/**
 * `in oklch` keeps midpoints vivid; omitted for srgb since that is the CSS default.
 *
 * Placement matters: the grammar combines <color-interpolation-method> with the
 * angle/position part, and only then takes a comma before the colour stops. So it
 * is `linear-gradient(90deg in oklch, …)`, never `linear-gradient(in oklch, 90deg, …)`
 * — browsers reject the latter outright and drop the whole layer.
 */
const interpolationSuffix = (layer: { interpolation: 'srgb' | 'oklch' }): string =>
  layer.interpolation === 'oklch' ? ' in oklch' : '';

function linearGradientImage(layer: LinearGradientLayer, format: ColorFormat): string {
  const head = `${degrees(layer.angle)}${interpolationSuffix(layer)}, `;
  return `${layer.kind}(${head}${formatStops(layer.stops, layer.opacity, format)})`;
}

function radialGradientImage(layer: RadialGradientLayer, format: ColorFormat): string {
  const shape = `${layer.shape} ${formatRadialSize(layer.radialSize)}`;
  const head = `${shape} at ${formatPosition(layer.center)}${interpolationSuffix(layer)}, `;
  return `${layer.kind}(${head}${formatStops(layer.stops, layer.opacity, format)})`;
}

function conicGradientImage(layer: ConicGradientLayer, format: ColorFormat): string {
  const head = `from ${degrees(layer.fromAngle)} at ${formatPosition(layer.center)}${interpolationSuffix(layer)}, `;
  return `${layer.kind}(${head}${formatStops(layer.stops, layer.opacity, format)})`;
}

/**
 * background-image cannot take a bare colour, so a solid layer becomes a
 * two-stop gradient of the same colour. This is the standard workaround.
 */
function solidImage(layer: SolidLayer, format: ColorFormat): string {
  const color = serializeColor(withAlphaScale(layer.color, layer.opacity), format);
  return `linear-gradient(${color}, ${color})`;
}

function layerToBackgroundImage(layer: Layer, format: ColorFormat): string | null {
  switch (layer.kind) {
    case 'linear-gradient':
    case 'repeating-linear-gradient':
      return linearGradientImage(layer, format);
    case 'radial-gradient':
    case 'repeating-radial-gradient':
      return radialGradientImage(layer, format);
    case 'conic-gradient':
    case 'repeating-conic-gradient':
      return conicGradientImage(layer, format);
    case 'solid':
      return solidImage(layer, format);
    case 'image':
      // A rejected URL drops the layer rather than emitting anything unvalidated.
      return isAllowedImageUrl(layer.url) ? `url("${layer.url}")` : null;
  }
}

/* -------------------------------------------------------------------------- */
/* Generation                                                                  */
/* -------------------------------------------------------------------------- */

type RenderableLayer = { layer: Layer; image: string };

function renderableLayers(pattern: Pattern, format: ColorFormat): RenderableLayer[] {
  const renderable: RenderableLayer[] = [];

  for (const layer of pattern.layers) {
    if (!layer.visible) continue;
    const image = layerToBackgroundImage(layer, format);
    if (image === null) continue;
    renderable.push({ layer, image });
  }

  return renderable;
}

const usesBlendModes = (layers: readonly RenderableLayer[]): boolean =>
  layers.some(({ layer }) => layer.blendMode !== 'normal');

function longhand(layers: readonly RenderableLayer[], baseColor: string): string {
  if (layers.length === 0) {
    return `background-color: ${baseColor};`;
  }

  const declarations = [
    `background-color: ${baseColor};`,
    `background-image: ${layers.map(({ image }) => image).join(',\n                  ')};`,
    `background-size: ${layers.map(({ layer }) => formatSize(layer.size)).join(', ')};`,
    `background-position: ${layers.map(({ layer }) => formatPosition(layer.position)).join(', ')};`,
    `background-repeat: ${layers.map(({ layer }) => layer.repeat).join(', ')};`,
  ];

  if (usesBlendModes(layers)) {
    declarations.push(
      `background-blend-mode: ${layers.map(({ layer }) => layer.blendMode).join(', ')};`,
    );
  }

  return declarations.join('\n');
}

/**
 * The `background` shorthand resets background-color, so the base colour is
 * emitted inside the final layer rather than as its own declaration.
 */
function shorthand(layers: readonly RenderableLayer[], baseColor: string): string {
  if (layers.length === 0) {
    return `background: ${baseColor};`;
  }

  const parts = layers.map(({ layer, image }, index) => {
    const value = `${image} ${formatPosition(layer.position)} / ${formatSize(layer.size)} ${layer.repeat}`;
    return index === layers.length - 1 ? `${value} ${baseColor}` : value;
  });

  const declarations = [`background: ${parts.join(',\n            ')};`];

  if (usesBlendModes(layers)) {
    declarations.push(
      `background-blend-mode: ${layers.map(({ layer }) => layer.blendMode).join(', ')};`,
    );
  }

  return declarations.join('\n');
}

/**
 * Turns a pattern into the CSS string that is both copied by the user and
 * applied by the preview. One generator, one string — see CLAUDE.md.
 *
 * Deterministic: the same pattern and options always produce byte-identical output.
 */
export function generateCss(pattern: Pattern, options: CssOptions = DEFAULT_CSS_OPTIONS): string {
  const layers = renderableLayers(pattern, options.colorFormat);
  const baseColor = serializeColor(pattern.canvas.baseColor, options.colorFormat);

  return options.mode === 'longhand' ? longhand(layers, baseColor) : shorthand(layers, baseColor);
}
