import { makeColor, type Color } from '../domain/color';
import { pct, px } from '../domain/length';
import { SCHEMA_VERSION } from '../domain/types';
import type {
  ConicGradientLayer,
  ImageLayer,
  Layer,
  LinearGradientLayer,
  Pattern,
  RadialGradientLayer,
  SolidLayer,
} from '../domain/types';

/**
 * Shared fixtures. Ids are stable because crypto.randomUUID is stubbed in setup.ts,
 * but factories take an explicit id so tests never depend on call order.
 */

export const RED: Color = makeColor(0.63, 0.26, 29);
export const BLUE: Color = makeColor(0.45, 0.31, 264);
export const WHITE: Color = makeColor(1, 0, 0);
export const TRANSPARENT: Color = makeColor(0, 0, 0, 0);

const layerBase = (id: string, name: string) => ({
  id,
  name,
  visible: true,
  blendMode: 'normal' as const,
  size: { kind: 'auto' as const },
  position: { x: pct(0), y: pct(0) },
  repeat: 'repeat' as const,
});

export function makeLinearLayer(overrides: Partial<LinearGradientLayer> = {}): LinearGradientLayer {
  return {
    ...layerBase('layer-1', 'Linear'),
    kind: 'linear-gradient',
    angle: 90,
    opacity: 1,
    interpolation: 'srgb',
    stops: [
      { color: RED, position: pct(0) },
      { color: BLUE, position: pct(100) },
    ],
    ...overrides,
  };
}

export function makeRadialLayer(overrides: Partial<RadialGradientLayer> = {}): RadialGradientLayer {
  return {
    ...layerBase('layer-2', 'Radial'),
    kind: 'radial-gradient',
    shape: 'circle',
    radialSize: { kind: 'extent', extent: 'farthest-corner' },
    center: { x: pct(50), y: pct(50) },
    opacity: 1,
    interpolation: 'srgb',
    stops: [
      { color: WHITE, position: pct(0) },
      { color: TRANSPARENT, position: pct(100) },
    ],
    ...overrides,
  };
}

export function makeConicLayer(overrides: Partial<ConicGradientLayer> = {}): ConicGradientLayer {
  return {
    ...layerBase('layer-3', 'Conic'),
    kind: 'conic-gradient',
    fromAngle: 0,
    center: { x: pct(50), y: pct(50) },
    opacity: 1,
    interpolation: 'srgb',
    stops: [
      { color: RED, position: pct(0) },
      { color: BLUE, position: pct(100) },
    ],
    ...overrides,
  };
}

export function makeSolidLayer(overrides: Partial<SolidLayer> = {}): SolidLayer {
  return {
    ...layerBase('layer-4', 'Solid'),
    kind: 'solid',
    color: RED,
    opacity: 1,
    ...overrides,
  };
}

export function makeImageLayer(overrides: Partial<ImageLayer> = {}): ImageLayer {
  return {
    ...layerBase('layer-5', 'Image'),
    kind: 'image',
    url: 'https://example.com/texture.png',
    ...overrides,
  };
}

/** A fixed-width diagonal stripe pattern — the thing percentage-only stops could not express. */
export function makeStripeLayer(overrides: Partial<LinearGradientLayer> = {}): LinearGradientLayer {
  return makeLinearLayer({
    id: 'stripes',
    name: 'Stripes',
    kind: 'repeating-linear-gradient',
    angle: 45,
    size: { kind: 'custom', width: px(40), height: px(40) },
    stops: [
      { color: RED, position: px(0) },
      { color: RED, position: px(10) },
      { color: BLUE, position: px(10) },
      { color: BLUE, position: px(20) },
    ],
    ...overrides,
  });
}

export function makePattern(layers: Layer[] = [makeLinearLayer()]): Pattern {
  return {
    v: SCHEMA_VERSION,
    layers,
    canvas: { width: 800, height: 600, baseColor: WHITE },
  };
}
