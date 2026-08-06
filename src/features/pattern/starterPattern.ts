import { makeColor } from '../../domain/color';
import { pct } from '../../domain/length';
import { SCHEMA_VERSION, type Pattern } from '../../domain/types';

/**
 * Shown on first load so the app never opens on a blank canvas.
 * Two blended glows over a dark base — exercises alpha, blend modes and stacking.
 */
export const starterPattern: Pattern = {
  v: SCHEMA_VERSION,
  layers: [
    {
      id: 'starter-glow-1',
      name: 'Cyan glow',
      kind: 'radial-gradient',
      visible: true,
      blendMode: 'screen',
      size: { kind: 'auto' },
      position: { x: pct(0), y: pct(0) },
      repeat: 'no-repeat',
      shape: 'circle',
      radialSize: { kind: 'extent', extent: 'farthest-side' },
      center: { x: pct(18), y: pct(22) },
      opacity: 0.9,
      interpolation: 'oklch',
      stops: [
        { color: makeColor(0.8, 0.16, 205), position: pct(0) },
        { color: makeColor(0.8, 0.16, 205, 0), position: pct(100) },
      ],
    },
    {
      id: 'starter-glow-2',
      name: 'Magenta glow',
      kind: 'radial-gradient',
      visible: true,
      blendMode: 'screen',
      size: { kind: 'auto' },
      position: { x: pct(0), y: pct(0) },
      repeat: 'no-repeat',
      shape: 'circle',
      radialSize: { kind: 'extent', extent: 'farthest-side' },
      center: { x: pct(82), y: pct(74) },
      opacity: 0.85,
      interpolation: 'oklch',
      stops: [
        { color: makeColor(0.68, 0.24, 335), position: pct(0) },
        { color: makeColor(0.68, 0.24, 335, 0), position: pct(100) },
      ],
    },
    {
      id: 'starter-wash',
      name: 'Diagonal wash',
      kind: 'linear-gradient',
      visible: true,
      blendMode: 'normal',
      size: { kind: 'auto' },
      position: { x: pct(0), y: pct(0) },
      repeat: 'no-repeat',
      angle: 145,
      opacity: 1,
      interpolation: 'oklch',
      stops: [
        { color: makeColor(0.32, 0.09, 275), position: pct(0) },
        { color: makeColor(0.18, 0.05, 250), position: pct(100) },
      ],
    },
  ],
  canvas: { width: 800, height: 500, baseColor: makeColor(0.14, 0.03, 265) },
};
