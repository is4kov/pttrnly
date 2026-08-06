import { describe, expect, it } from 'vitest';
import { generateCss, type CssOptions } from './css';
import { COLOR_FORMATS } from './color';
import { pct, px } from './length';
import {
  BLUE,
  RED,
  makeConicLayer,
  makeImageLayer,
  makeLinearLayer,
  makePattern,
  makeRadialLayer,
  makeSolidLayer,
  makeStripeLayer,
} from '../test/factories';

const longhandHex: CssOptions = { mode: 'longhand', colorFormat: 'hex' };
const shorthandHex: CssOptions = { mode: 'shorthand', colorFormat: 'hex' };

describe('generateCss — longhand', () => {
  it('emits one declaration per background property', () => {
    const css = generateCss(makePattern(), longhandHex);

    expect(css).toBe(
      [
        'background-color: #ffffff;',
        'background-image: linear-gradient(90deg, #ff0a0a 0%, #0032e2 100%);',
        'background-size: auto;',
        'background-position: 0% 0%;',
        'background-repeat: repeat;',
      ].join('\n'),
    );
  });

  it('omits background-blend-mode when every layer is normal', () => {
    expect(generateCss(makePattern(), longhandHex)).not.toContain('background-blend-mode');
  });

  it('emits background-blend-mode when any layer sets one', () => {
    const pattern = makePattern([
      makeLinearLayer({ blendMode: 'multiply' }),
      makeSolidLayer({ id: 'b' }),
    ]);

    expect(generateCss(pattern, longhandHex)).toContain('background-blend-mode: multiply, normal;');
  });

  it('falls back to the base colour when there are no layers', () => {
    expect(generateCss(makePattern([]), longhandHex)).toBe('background-color: #ffffff;');
  });
});

describe('generateCss — shorthand', () => {
  it('folds the base colour into the final layer', () => {
    const css = generateCss(makePattern(), shorthandHex);

    expect(css).toBe(
      'background: linear-gradient(90deg, #ff0a0a 0%, #0032e2 100%) 0% 0% / auto repeat #ffffff;',
    );
  });

  it('only attaches the base colour to the last layer', () => {
    const pattern = makePattern([makeLinearLayer(), makeSolidLayer({ id: 'b' })]);
    const css = generateCss(pattern, shorthandHex);
    const occurrences = css.split('#ffffff').length - 1;

    expect(occurrences).toBe(1);
    expect(css.trimEnd().endsWith('#ffffff;')).toBe(true);
  });

  it('falls back to the base colour when there are no layers', () => {
    expect(generateCss(makePattern([]), shorthandHex)).toBe('background: #ffffff;');
  });
});

describe('layer ordering', () => {
  it('keeps index 0 first, which paints on top', () => {
    const pattern = makePattern([
      makeLinearLayer({ id: 'top', angle: 0 }),
      makeLinearLayer({ id: 'bottom', angle: 180 }),
    ]);

    const css = generateCss(pattern, longhandHex);
    const topIndex = css.indexOf('0deg');
    const bottomIndex = css.indexOf('180deg');

    expect(topIndex).toBeGreaterThan(-1);
    expect(topIndex).toBeLessThan(bottomIndex);
  });

  it('drops hidden layers without disturbing the order of the rest', () => {
    const pattern = makePattern([
      makeLinearLayer({ id: 'a', angle: 0 }),
      makeLinearLayer({ id: 'b', angle: 90, visible: false }),
      makeLinearLayer({ id: 'c', angle: 180 }),
    ]);

    const css = generateCss(pattern, longhandHex);

    expect(css).toContain('0deg');
    expect(css).not.toContain('90deg');
    expect(css).toContain('180deg');
    expect(css).toContain('background-repeat: repeat, repeat;');
  });
});

describe('layer kinds', () => {
  it('renders a radial gradient', () => {
    const pattern = makePattern([makeRadialLayer()]);

    expect(generateCss(pattern, longhandHex)).toContain(
      'radial-gradient(circle farthest-corner at 50% 50%, #ffffff 0%, #00000000 100%)',
    );
  });

  it('renders a conic gradient', () => {
    const pattern = makePattern([makeConicLayer()]);

    expect(generateCss(pattern, longhandHex)).toContain(
      'conic-gradient(from 0deg at 50% 50%, #ff0a0a 0%, #0032e2 100%)',
    );
  });

  it('renders repeating variants under their own function name', () => {
    const pattern = makePattern([makeLinearLayer({ kind: 'repeating-linear-gradient' })]);

    expect(generateCss(pattern, longhandHex)).toContain('repeating-linear-gradient(90deg');
  });

  it('renders a solid layer as a two-stop gradient', () => {
    const pattern = makePattern([makeSolidLayer()]);

    expect(generateCss(pattern, longhandHex)).toContain('linear-gradient(#ff0a0a, #ff0a0a)');
  });

  it('emits the oklch interpolation hint only when requested', () => {
    const srgb = makePattern([makeLinearLayer({ interpolation: 'srgb' })]);
    const oklch = makePattern([makeLinearLayer({ interpolation: 'oklch' })]);

    expect(generateCss(srgb, longhandHex)).not.toContain('in oklch');
    expect(generateCss(oklch, longhandHex)).toContain('linear-gradient(in oklch, 90deg');
  });
});

describe('image layers', () => {
  it('quotes an allowed URL', () => {
    const pattern = makePattern([makeImageLayer()]);

    expect(generateCss(pattern, longhandHex)).toContain('url("https://example.com/texture.png")');
  });

  it('drops the layer entirely when the URL is rejected', () => {
    const pattern = makePattern([makeImageLayer({ url: 'javascript:alert(1)' })]);

    expect(generateCss(pattern, longhandHex)).toBe('background-color: #ffffff;');
  });

  it('never lets a rejected URL reach the output', () => {
    const pattern = makePattern([
      makeImageLayer({ url: 'https://example.com/a.png") ; color: red; background: url("x' }),
    ]);

    const css = generateCss(pattern, longhandHex);

    expect(css).not.toContain('color: red');
    expect(css).toBe('background-color: #ffffff;');
  });
});

describe('opacity', () => {
  it('bakes layer opacity into stop alphas rather than emitting a declaration', () => {
    const pattern = makePattern([makeLinearLayer({ opacity: 0.5 })]);
    const css = generateCss(pattern, { mode: 'longhand', colorFormat: 'rgb' });

    expect(css).toContain('/ 0.5');
    expect(css).not.toContain('opacity');
  });

  it('multiplies with a stop’s own alpha', () => {
    const pattern = makePattern([
      makeLinearLayer({
        opacity: 0.5,
        stops: [
          { color: { ...RED, alpha: 0.5 }, position: pct(0) },
          { color: BLUE, position: pct(100) },
        ],
      }),
    ]);

    expect(generateCss(pattern, { mode: 'longhand', colorFormat: 'rgb' })).toContain('/ 0.25');
  });
});

describe('numeric formatting', () => {
  it('clamps out-of-range values instead of emitting them', () => {
    const pattern = makePattern([
      makeLinearLayer({
        angle: 99_999,
        size: { kind: 'custom', width: px(1e9), height: px(-1e9) },
      }),
    ]);

    const css = generateCss(pattern, longhandHex);

    expect(css).toContain('3600deg');
    expect(css).toContain('background-size: 10000px 0px;');
  });

  it('does not emit negative zero', () => {
    const pattern = makePattern([makeLinearLayer({ angle: -0 })]);

    expect(generateCss(pattern, longhandHex)).toContain('0deg');
    expect(generateCss(pattern, longhandHex)).not.toContain('-0deg');
  });
});

describe('output matrix', () => {
  const pattern = makePattern([
    makeLinearLayer(),
    makeRadialLayer(),
    makeSolidLayer({ id: 'c', opacity: 0.4 }),
  ]);

  it('produces deterministic output for every mode and colour format', () => {
    for (const mode of ['longhand', 'shorthand'] as const) {
      for (const colorFormat of COLOR_FORMATS) {
        const options: CssOptions = { mode, colorFormat };
        const first = generateCss(pattern, options);

        expect(generateCss(pattern, options)).toBe(first);
        expect(first.length).toBeGreaterThan(0);
      }
    }
  });

  it('describes the same layers in both modes', () => {
    for (const colorFormat of COLOR_FORMATS) {
      const long = generateCss(pattern, { mode: 'longhand', colorFormat });
      const short = generateCss(pattern, { mode: 'shorthand', colorFormat });

      // Same images, same order, in both modes.
      for (const fragment of ['linear-gradient(90deg', 'radial-gradient(circle', 'repeat']) {
        expect(long).toContain(fragment);
        expect(short).toContain(fragment);
      }
    }
  });
});

describe('lengths', () => {
  it('emits px sizes, positions and stop offsets', () => {
    const pattern = makePattern([makeStripeLayer()]);
    const css = generateCss(pattern, longhandHex);

    expect(css).toContain(
      'repeating-linear-gradient(45deg, #ff0a0a 0px, #ff0a0a 10px, #0032e2 10px, #0032e2 20px)',
    );
    expect(css).toContain('background-size: 40px 40px;');
  });

  it('mixes units within one declaration', () => {
    const pattern = makePattern([
      makeLinearLayer({
        size: { kind: 'custom', width: px(24), height: pct(50) },
        position: { x: px(-8), y: pct(25) },
      }),
    ]);

    const css = generateCss(pattern, longhandHex);

    expect(css).toContain('background-size: 24px 50%;');
    expect(css).toContain('background-position: -8px 25%;');
  });

  it('supports auto on a single axis', () => {
    const pattern = makePattern([
      makeLinearLayer({ size: { kind: 'custom', width: 'auto', height: px(30) } }),
    ]);

    expect(generateCss(pattern, longhandHex)).toContain('background-size: auto 30px;');
  });

  it('always emits the unit, never a bare zero', () => {
    const pattern = makePattern([makeLinearLayer({ position: { x: px(0), y: pct(0) } })]);

    expect(generateCss(pattern, longhandHex)).toContain('background-position: 0px 0%;');
  });

  it('clamps negative background-size to zero', () => {
    const pattern = makePattern([
      makeLinearLayer({ size: { kind: 'custom', width: px(-50), height: pct(-10) } }),
    ]);

    expect(generateCss(pattern, longhandHex)).toContain('background-size: 0px 0%;');
  });

  it('allows negative positions and stop offsets', () => {
    const pattern = makePattern([
      makeLinearLayer({
        position: { x: px(-20), y: px(-5) },
        stops: [
          { color: RED, position: px(-10) },
          { color: BLUE, position: px(30) },
        ],
      }),
    ]);

    const css = generateCss(pattern, longhandHex);

    expect(css).toContain('background-position: -20px -5px;');
    expect(css).toContain('#ff0a0a -10px, #0032e2 30px');
  });
});

describe('radial sizing', () => {
  it('emits an extent keyword', () => {
    const pattern = makePattern([
      makeRadialLayer({ radialSize: { kind: 'extent', extent: 'closest-side' } }),
    ]);

    expect(generateCss(pattern, longhandHex)).toContain('radial-gradient(circle closest-side at');
  });

  it('emits an explicit circle radius in px', () => {
    const pattern = makePattern([
      makeRadialLayer({ radialSize: { kind: 'circle', radius: px(80) } }),
    ]);

    expect(generateCss(pattern, longhandHex)).toContain('radial-gradient(circle 80px at 50% 50%');
  });

  it('emits ellipse radii, which may be percentages', () => {
    const pattern = makePattern([
      makeRadialLayer({
        shape: 'ellipse',
        radialSize: { kind: 'ellipse', x: px(60), y: pct(40) },
      }),
    ]);

    expect(generateCss(pattern, longhandHex)).toContain(
      'radial-gradient(ellipse 60px 40% at 50% 50%',
    );
  });
});
