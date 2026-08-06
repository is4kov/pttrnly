import { makeColor } from '../../domain/color';
import { pct, px } from '../../domain/length';
import { SCHEMA_VERSION, type Layer, type Pattern } from '../../domain/types';
import { starterPattern } from '../pattern/starterPattern';

/** Built-in starting points. Each exercises a different part of the generator. */

export type Preset = {
  id: string;
  name: string;
  description: string;
  pattern: Pattern;
};

const canvas = (baseColor: Pattern['canvas']['baseColor']): Pattern['canvas'] => ({
  width: 800,
  height: 500,
  baseColor,
});

const base = (id: string, name: string) => ({
  id,
  name,
  visible: true,
  blendMode: 'normal' as const,
  size: { kind: 'auto' as const },
  position: { x: pct(0), y: pct(0) },
  repeat: 'no-repeat' as const,
});

const stripes: Layer = {
  ...base('stripes', 'Diagonal stripes'),
  kind: 'repeating-linear-gradient',
  repeat: 'repeat',
  size: { kind: 'custom', width: px(40), height: px(40) },
  angle: 45,
  opacity: 1,
  interpolation: 'srgb',
  stops: [
    { color: makeColor(0.22, 0.06, 260), position: px(0) },
    { color: makeColor(0.22, 0.06, 260), position: px(10) },
    { color: makeColor(0.94, 0.02, 260), position: px(10) },
    { color: makeColor(0.94, 0.02, 260), position: px(20) },
  ],
};

const checks: Layer[] = [
  {
    ...base('checks-a', 'Checks light'),
    kind: 'repeating-conic-gradient',
    repeat: 'repeat',
    size: { kind: 'custom', width: px(48), height: px(48) },
    fromAngle: 0,
    center: { x: pct(50), y: pct(50) },
    opacity: 1,
    interpolation: 'srgb',
    stops: [
      { color: makeColor(0.9, 0.03, 90), position: pct(0) },
      { color: makeColor(0.9, 0.03, 90), position: pct(25) },
      { color: makeColor(0.55, 0.12, 150), position: pct(25) },
      { color: makeColor(0.55, 0.12, 150), position: pct(50) },
    ],
  },
];

const sunset: Layer[] = [
  {
    ...base('sunset-glow', 'Sun'),
    kind: 'radial-gradient',
    shape: 'circle',
    radialSize: { kind: 'circle', radius: px(180) },
    center: { x: pct(50), y: pct(78) },
    blendMode: 'screen',
    opacity: 0.95,
    interpolation: 'oklch',
    stops: [
      { color: makeColor(0.92, 0.15, 85), position: pct(0) },
      { color: makeColor(0.75, 0.2, 45, 0), position: pct(100) },
    ],
  },
  {
    ...base('sunset-sky', 'Sky'),
    kind: 'linear-gradient',
    angle: 180,
    opacity: 1,
    interpolation: 'oklch',
    stops: [
      { color: makeColor(0.35, 0.13, 285), position: pct(0) },
      { color: makeColor(0.62, 0.19, 20), position: pct(65) },
      { color: makeColor(0.82, 0.13, 60), position: pct(100) },
    ],
  },
];

const grid: Layer[] = [
  {
    ...base('grid-v', 'Vertical rules'),
    kind: 'repeating-linear-gradient',
    repeat: 'repeat',
    size: { kind: 'custom', width: px(32), height: px(32) },
    angle: 90,
    opacity: 1,
    interpolation: 'srgb',
    stops: [
      { color: makeColor(0.7, 0.05, 250, 0.35), position: px(0) },
      { color: makeColor(0.7, 0.05, 250, 0.35), position: px(1) },
      { color: makeColor(0.7, 0.05, 250, 0), position: px(1) },
      { color: makeColor(0.7, 0.05, 250, 0), position: px(32) },
    ],
  },
  {
    ...base('grid-h', 'Horizontal rules'),
    kind: 'repeating-linear-gradient',
    repeat: 'repeat',
    size: { kind: 'custom', width: px(32), height: px(32) },
    angle: 0,
    opacity: 1,
    interpolation: 'srgb',
    stops: [
      { color: makeColor(0.7, 0.05, 250, 0.35), position: px(0) },
      { color: makeColor(0.7, 0.05, 250, 0.35), position: px(1) },
      { color: makeColor(0.7, 0.05, 250, 0), position: px(1) },
      { color: makeColor(0.7, 0.05, 250, 0), position: px(32) },
    ],
  },
];

export const presets: readonly Preset[] = [
  {
    id: 'aurora',
    name: 'Aurora',
    description: 'Two blended glows over a dark wash',
    pattern: starterPattern,
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Layered sky with a screened sun',
    pattern: { v: SCHEMA_VERSION, layers: sunset, canvas: canvas(makeColor(0.25, 0.1, 300)) },
  },
  {
    id: 'stripes',
    name: 'Barber stripes',
    description: 'Fixed-width diagonal tile',
    pattern: { v: SCHEMA_VERSION, layers: [stripes], canvas: canvas(makeColor(1, 0, 0)) },
  },
  {
    id: 'checks',
    name: 'Checkerboard',
    description: 'Conic gradient tiled into squares',
    pattern: { v: SCHEMA_VERSION, layers: checks, canvas: canvas(makeColor(1, 0, 0)) },
  },
  {
    id: 'grid',
    name: 'Graph paper',
    description: 'Two hairline grids over a tint',
    pattern: { v: SCHEMA_VERSION, layers: grid, canvas: canvas(makeColor(0.97, 0.01, 250)) },
  },
];
