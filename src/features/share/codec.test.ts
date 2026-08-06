import { describe, expect, it } from 'vitest';
import { decodePattern, encodePattern } from './codec';
import {
  makeConicLayer,
  makeImageLayer,
  makeLinearLayer,
  makePattern,
  makeRadialLayer,
  makeSolidLayer,
  makeStripeLayer,
} from '../../test/factories';
import { pct, px } from '../../domain/length';
import { presets } from '../presets/presets';

describe('round trip', () => {
  it('survives every layer kind', () => {
    const pattern = makePattern([
      makeLinearLayer(),
      makeRadialLayer(),
      makeConicLayer(),
      makeSolidLayer(),
      makeImageLayer(),
      makeStripeLayer(),
    ]);

    expect(decodePattern(encodePattern(pattern))).toEqual(pattern);
  });

  it('survives every preset', () => {
    for (const preset of presets) {
      expect(decodePattern(encodePattern(preset.pattern))).toEqual(preset.pattern);
    }
  });

  it('preserves units, so a px stripe stays a px stripe', () => {
    const pattern = makePattern([makeStripeLayer()]);
    const decoded = decodePattern(encodePattern(pattern));
    const layer = decoded?.layers[0];

    expect(layer?.size.kind).toBe('custom');
    expect(layer && 'stops' in layer ? layer.stops[1]?.position : null).toEqual(px(10));
  });

  it('preserves an auto axis on a custom size', () => {
    const pattern = makePattern([
      makeLinearLayer({ size: { kind: 'custom', width: 'auto', height: px(30) } }),
    ]);

    expect(decodePattern(encodePattern(pattern))).toEqual(pattern);
  });

  it('preserves each radial sizing form', () => {
    const forms = [
      { kind: 'extent', extent: 'closest-side' },
      { kind: 'circle', radius: px(80) },
      { kind: 'ellipse', x: px(60), y: pct(40) },
    ] as const;

    for (const radialSize of forms) {
      const pattern = makePattern([makeRadialLayer({ radialSize })]);
      expect(decodePattern(encodePattern(pattern))).toEqual(pattern);
    }
  });

  it('preserves layer order, which decides what paints on top', () => {
    const pattern = makePattern([
      makeLinearLayer({ id: 'top', name: 'Top' }),
      makeSolidLayer({ id: 'bottom', name: 'Bottom' }),
    ]);

    const decoded = decodePattern(encodePattern(pattern));

    expect(decoded?.layers.map((layer) => layer.id)).toEqual(['top', 'bottom']);
  });

  it('preserves hidden layers', () => {
    const pattern = makePattern([makeLinearLayer({ visible: false })]);

    expect(decodePattern(encodePattern(pattern))?.layers[0]?.visible).toBe(false);
  });

  it('is stable — encoding twice gives the same string', () => {
    const pattern = makePattern([makeLinearLayer(), makeRadialLayer()]);

    expect(encodePattern(pattern)).toBe(encodePattern(pattern));
  });
});

describe('compactness', () => {
  it('is markedly shorter than base64 of the stored JSON', () => {
    const pattern = makePattern([makeLinearLayer(), makeRadialLayer(), makeConicLayer()]);

    const naive = btoa(JSON.stringify(pattern)).length;
    const compact = encodePattern(pattern).length;

    expect(compact).toBeLessThan(naive / 2);
  });

  it('keeps a typical pattern inside a pasteable length', () => {
    const encoded = encodePattern(presets[0]?.pattern ?? makePattern());

    expect(encoded.length).toBeLessThan(2000);
  });

  it('emits only URL-safe characters', () => {
    const encoded = encodePattern(makePattern([makeLinearLayer(), makeImageLayer()]));

    expect(encoded).toMatch(/^[A-Za-z0-9\-_]+$/);
  });
});

describe('decoding untrusted input', () => {
  it('rejects malformed base64 without throwing', () => {
    for (const bad of ['', 'not base64!!', '###', 'a']) {
      expect(decodePattern(bad)).toBeNull();
    }
  });

  it('rejects valid base64 that is not JSON', () => {
    expect(decodePattern(btoa('hello world').replace(/=+$/, ''))).toBeNull();
  });

  it('rejects a wire version it does not understand', () => {
    const payload = btoa(JSON.stringify([99, [], [800, 600, [1, 0, 0, 1]]])).replace(/=+$/, '');

    expect(decodePattern(payload)).toBeNull();
  });

  it('rejects a payload that is not the expected triple', () => {
    for (const wire of [[], [1], [1, []], {}, 'string', 42]) {
      const payload = btoa(JSON.stringify(wire)).replace(/=+$/, '');
      expect(decodePattern(payload)).toBeNull();
    }
  });

  it('refuses an injected image URL, because decoding goes through the parser', () => {
    const pattern = makePattern([makeImageLayer()]);
    const wire = JSON.parse(atob(encodePattern(pattern).replace(/-/g, '+').replace(/_/g, '/'))) as [
      number,
      unknown[][],
      unknown,
    ];

    const layer = wire[1][0];
    expect(layer).toBeDefined();
    if (!layer) return;
    layer[8] = 'javascript:alert(1)';

    const tampered = btoa(JSON.stringify(wire))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    expect(decodePattern(tampered)).toBeNull();
  });

  it('refuses a tampered blend mode', () => {
    const wire = JSON.parse(
      atob(encodePattern(makePattern()).replace(/-/g, '+').replace(/_/g, '/')),
    ) as [number, unknown[][], unknown];

    const layer = wire[1][0];
    expect(layer).toBeDefined();
    if (!layer) return;
    layer[4] = 'sparkle';

    const tampered = btoa(JSON.stringify(wire))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    expect(decodePattern(tampered)).toBeNull();
  });

  it('never throws, whatever it is handed', () => {
    const payloads = [
      '%%%',
      'AAAA',
      btoa('[]'),
      btoa('null'),
      btoa('[1,null,null]'),
      'A'.repeat(5000),
    ];

    for (const payload of payloads) {
      expect(() => decodePattern(payload)).not.toThrow();
    }
  });
});
