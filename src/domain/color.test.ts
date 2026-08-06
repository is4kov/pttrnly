import { describe, expect, it } from 'vitest';
import {
  COLOR_FORMATS,
  gamutMapToSrgb,
  isOutOfSrgbGamut,
  makeColor,
  parseHex,
  serializeColor,
  withAlphaScale,
} from './color';
import type { Color } from './color';

/** parseHex returns null for bad input; tests that expect success should fail loudly. */
function mustParse(hex: string): Color {
  const color = parseHex(hex);
  if (color === null) throw new Error(`expected ${hex} to parse`);
  return color;
}

describe('makeColor', () => {
  it('clamps lightness and alpha into range', () => {
    expect(makeColor(2, 0, 0, 5)).toMatchObject({ l: 1, alpha: 1 });
    expect(makeColor(-1, 0, 0, -1)).toMatchObject({ l: 0, alpha: 0 });
  });

  it('normalises hue into 0–360', () => {
    expect(makeColor(0.5, 0.1, 420).h).toBe(60);
    expect(makeColor(0.5, 0.1, -30).h).toBe(330);
  });
});

describe('parseHex', () => {
  it('rejects anything that is not a hex colour', () => {
    expect(parseHex('red')).toBeNull();
    expect(parseHex('#12')).toBeNull();
    expect(parseHex('#gggggg')).toBeNull();
    expect(parseHex('')).toBeNull();
  });

  it('round-trips pure white and pure black', () => {
    expect(serializeColor(mustParse('#ffffff'), 'hex')).toBe('#ffffff');
    expect(serializeColor(mustParse('#000000'), 'hex')).toBe('#000000');
  });

  it('round-trips saturated colours through OKLCH without drift', () => {
    for (const hex of ['#ff0000', '#00ff00', '#0000ff', '#7f3fbf', '#123456']) {
      expect(serializeColor(mustParse(hex), 'hex')).toBe(hex);
    }
  });

  it('expands shorthand notation', () => {
    expect(serializeColor(mustParse('#f00'), 'hex')).toBe('#ff0000');
  });

  it('preserves alpha', () => {
    expect(serializeColor(mustParse('#ff000080'), 'hex')).toBe('#ff000080');
  });
});

describe('serializeColor', () => {
  const teal = mustParse('#0d9488');

  it('emits every format from the same colour', () => {
    expect(serializeColor(teal, 'hex')).toBe('#0d9488');
    expect(serializeColor(teal, 'rgb')).toBe('rgb(13 148 136)');
    expect(serializeColor(teal, 'hsl')).toBe('hsl(174.7 83.9% 31.6%)');
    expect(serializeColor(teal, 'oklch')).toMatch(
      /^oklch\(\d+(\.\d+)?% \d+(\.\d+)? \d+(\.\d+)?\)$/,
    );
  });

  it('includes alpha only when it is below 1', () => {
    const half = withAlphaScale(teal, 0.5);

    expect(serializeColor(teal, 'rgb')).not.toContain('/');
    expect(serializeColor(half, 'rgb')).toBe('rgb(13 148 136 / 0.5)');
    expect(serializeColor(half, 'hsl')).toContain('/ 0.5');
    expect(serializeColor(half, 'oklch')).toContain('/ 0.5');
  });

  it('is deterministic across repeated calls', () => {
    for (const format of COLOR_FORMATS) {
      expect(serializeColor(teal, format)).toBe(serializeColor(teal, format));
    }
  });
});

describe('gamut mapping', () => {
  const neon = makeColor(0.7, 0.37, 150);

  it('detects colours outside sRGB', () => {
    expect(isOutOfSrgbGamut(neon)).toBe(true);
    expect(isOutOfSrgbGamut(makeColor(0.5, 0.02, 150))).toBe(false);
  });

  it('reduces chroma while preserving lightness and hue', () => {
    const mapped = gamutMapToSrgb(neon);

    expect(mapped.c).toBeLessThan(neon.c);
    expect(mapped.l).toBe(neon.l);
    expect(mapped.h).toBe(neon.h);
    expect(isOutOfSrgbGamut(mapped)).toBe(false);
  });

  it('leaves in-gamut colours untouched', () => {
    const safe = makeColor(0.5, 0.05, 200);

    expect(gamutMapToSrgb(safe)).toEqual(safe);
  });
});

describe('withAlphaScale', () => {
  it('multiplies alpha and clamps the result', () => {
    const color = makeColor(0.5, 0.1, 0, 0.5);

    expect(withAlphaScale(color, 0.5).alpha).toBe(0.25);
    expect(withAlphaScale(color, 4).alpha).toBe(1);
    expect(withAlphaScale(color, 0).alpha).toBe(0);
  });
});
