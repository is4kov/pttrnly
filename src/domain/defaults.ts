import { makeColor } from './color';
import { pct } from './length';
import type { Layer, LayerKind } from './types';

/** Starting values for a freshly created layer of each kind. */

const base = (id: string, name: string) => ({
  id,
  name,
  visible: true,
  blendMode: 'normal' as const,
  size: { kind: 'auto' as const },
  position: { x: pct(0), y: pct(0) },
  repeat: 'repeat' as const,
});

const gradientBase = {
  opacity: 1,
  interpolation: 'oklch' as const,
  stops: [
    { color: makeColor(0.72, 0.16, 250), position: pct(0) },
    { color: makeColor(0.5, 0.2, 320), position: pct(100) },
  ],
};

export const KIND_NAMES: Record<LayerKind, string> = {
  'linear-gradient': 'Linear gradient',
  'repeating-linear-gradient': 'Repeating linear',
  'radial-gradient': 'Radial gradient',
  'repeating-radial-gradient': 'Repeating radial',
  'conic-gradient': 'Conic gradient',
  'repeating-conic-gradient': 'Repeating conic',
  solid: 'Solid colour',
  image: 'Image',
};

export function createLayer(kind: LayerKind, id: string): Layer {
  const name = KIND_NAMES[kind];

  switch (kind) {
    case 'linear-gradient':
    case 'repeating-linear-gradient':
      return { ...base(id, name), ...gradientBase, kind, angle: 90 };

    case 'radial-gradient':
    case 'repeating-radial-gradient':
      return {
        ...base(id, name),
        ...gradientBase,
        kind,
        shape: 'circle',
        radialSize: { kind: 'extent', extent: 'farthest-corner' },
        center: { x: pct(50), y: pct(50) },
      };

    case 'conic-gradient':
    case 'repeating-conic-gradient':
      return {
        ...base(id, name),
        ...gradientBase,
        kind,
        fromAngle: 0,
        center: { x: pct(50), y: pct(50) },
      };

    case 'solid':
      return { ...base(id, name), kind, opacity: 1, color: makeColor(0.6, 0.18, 260) };

    case 'image':
      return { ...base(id, name), kind, url: '' };
  }
}
