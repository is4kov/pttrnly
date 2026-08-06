import { describe, expect, it } from 'vitest';
import { parsePattern, parsePatternJson } from './parse';
import { makePattern, makeImageLayer, makeLinearLayer, makeRadialLayer } from '../test/factories';
import { SCHEMA_VERSION } from './types';

/** A pattern that has been through JSON, as anything from storage or a URL has. */
const roundTrip = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

describe('parsePattern', () => {
  it('accepts a pattern it produced itself', () => {
    const pattern = makePattern([makeLinearLayer(), makeRadialLayer()]);

    expect(parsePattern(roundTrip(pattern))).toEqual(pattern);
  });

  it('rejects anything that is not an object', () => {
    for (const value of [null, undefined, 42, 'pattern', [], true]) {
      expect(parsePattern(value)).toBeNull();
    }
  });

  it('rejects an unknown schema version rather than guessing', () => {
    const pattern = roundTrip(makePattern()) as Record<string, unknown>;

    expect(parsePattern({ ...pattern, v: SCHEMA_VERSION + 1 })).toBeNull();
    expect(parsePattern({ ...pattern, v: 'one' })).toBeNull();
  });

  it('rejects a layer of an unknown kind', () => {
    const pattern = roundTrip(makePattern()) as { layers: Record<string, unknown>[] };
    const first = pattern.layers[0];

    expect(first).toBeDefined();
    if (!first) return;
    first.kind = 'plaid-gradient';

    expect(parsePattern(pattern)).toBeNull();
  });

  it('rejects a blend mode outside the enum', () => {
    const pattern = roundTrip(makePattern()) as { layers: Record<string, unknown>[] };
    const first = pattern.layers[0];

    expect(first).toBeDefined();
    if (!first) return;
    first.blendMode = 'sparkle';

    expect(parsePattern(pattern)).toBeNull();
  });

  it('rejects a disallowed image URL', () => {
    const pattern = roundTrip(makePattern([makeImageLayer({ url: 'javascript:alert(1)' })]));

    expect(parsePattern(pattern)).toBeNull();
  });

  it('allows an empty image URL, which is a layer mid-edit', () => {
    const pattern = roundTrip(makePattern([makeImageLayer({ url: '' })]));

    expect(parsePattern(pattern)).not.toBeNull();
  });

  it('rejects a circle radius given as a percentage, which CSS refuses', () => {
    const pattern = roundTrip(
      makePattern([
        makeRadialLayer({ radialSize: { kind: 'circle', radius: { value: 50, unit: 'px' } } }),
      ]),
    ) as { layers: Record<string, unknown>[] };

    const first = pattern.layers[0];
    expect(first).toBeDefined();
    if (!first) return;
    first.radialSize = { kind: 'circle', radius: { value: 50, unit: '%' } };

    expect(parsePattern(pattern)).toBeNull();
  });

  it('clamps out-of-range numbers rather than trusting them', () => {
    const pattern = roundTrip(makePattern()) as {
      layers: Record<string, unknown>[];
      canvas: Record<string, unknown>;
    };

    const first = pattern.layers[0];
    expect(first).toBeDefined();
    if (!first) return;

    first.angle = 9_000_000;
    first.position = { x: { value: 1e9, unit: 'px' }, y: { value: 0, unit: '%' } };
    pattern.canvas.width = 9e9;

    const parsed = parsePattern(pattern);
    const parsedLayer = parsed?.layers[0];

    expect(parsed).not.toBeNull();
    expect(parsedLayer && 'angle' in parsedLayer ? parsedLayer.angle : null).toBe(3600);
    expect(parsedLayer?.position.x.value).toBe(10_000);
    expect(parsed?.canvas.width).toBe(10_000);
  });

  it('rejects a gradient with fewer than two stops', () => {
    const pattern = roundTrip(makePattern()) as { layers: Record<string, unknown>[] };
    const first = pattern.layers[0];

    expect(first).toBeDefined();
    if (!first) return;
    first.stops = [
      { color: { l: 0.5, c: 0.1, h: 200, alpha: 1 }, position: { value: 0, unit: '%' } },
    ];

    expect(parsePattern(pattern)).toBeNull();
  });

  it('rejects more stops than the cap allows', () => {
    const pattern = roundTrip(makePattern()) as { layers: Record<string, unknown>[] };
    const first = pattern.layers[0];

    expect(first).toBeDefined();
    if (!first) return;
    first.stops = Array.from({ length: 65 }, () => ({
      color: { l: 0.5, c: 0.1, h: 200, alpha: 1 },
      position: { value: 0, unit: '%' },
    }));

    expect(parsePattern(pattern)).toBeNull();
  });

  it('rejects a missing canvas', () => {
    const pattern = roundTrip(makePattern()) as Record<string, unknown>;
    delete pattern.canvas;

    expect(parsePattern(pattern)).toBeNull();
  });

  it('rejects non-finite numbers', () => {
    const pattern = roundTrip(makePattern()) as { canvas: Record<string, unknown> };
    pattern.canvas.width = Number.NaN;

    expect(parsePattern(pattern)).toBeNull();
  });
});

describe('parsePatternJson', () => {
  it('parses a serialised pattern', () => {
    const pattern = makePattern();

    expect(parsePatternJson(JSON.stringify(pattern))).toEqual(pattern);
  });

  it('returns null for malformed JSON instead of throwing', () => {
    expect(parsePatternJson('{ not json')).toBeNull();
    expect(parsePatternJson('')).toBeNull();
  });

  it('survives adversarial payloads without throwing', () => {
    const payloads = [
      '{"v":1,"layers":"not-an-array","canvas":{}}',
      '{"v":1,"layers":[{"kind":"image","url":"javascript:alert(1)"}],"canvas":{}}',
      '{"v":1,"layers":[],"canvas":{"width":"wide","height":1,"baseColor":null}}',
      '[]',
      'null',
      '"{}"',
    ];

    for (const payload of payloads) {
      expect(parsePatternJson(payload)).toBeNull();
    }
  });
});
