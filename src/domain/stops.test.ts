import { describe, expect, it } from 'vitest';
import {
  colorAtFraction,
  MAX_STOPS,
  MIN_STOPS,
  mixColors,
  sortStops,
  stopFraction,
  trackSpan,
} from './stops';
import { makeColor, serializeColor } from './color';
import { pct, px } from './length';
import type { GradientStop } from './types';

const stop = (position: GradientStop['position'], color = makeColor(0.5, 0.1, 200)) => ({
  color,
  position,
});

describe('trackSpan', () => {
  it('holds a floor of 100 for percentages, so a 0-100 gradient fills the bar', () => {
    expect(trackSpan([stop(pct(0)), stop(pct(100))])).toEqual({ value: 100, unit: '%' });
  });

  it('leaves headroom past the largest pixel offset', () => {
    expect(trackSpan([stop(px(0)), stop(px(20))])).toEqual({ value: 30, unit: 'px' });
  });

  it('does not collapse when the rightmost stop moves left', () => {
    // The bug this guards: a span that tracked the largest offset shrank under
    // the stop being dragged, pinning it to the right edge forever.
    const wide = trackSpan([stop(px(0)), stop(px(20))]);
    const narrower = trackSpan([stop(px(0)), stop(px(19))]);

    expect(narrower).toEqual(wide);
  });

  it('keeps the percentage span steady while a stop moves within range', () => {
    expect(trackSpan([stop(pct(0)), stop(pct(60))])).toEqual({ value: 100, unit: '%' });
    expect(trackSpan([stop(pct(0)), stop(pct(90))])).toEqual({ value: 100, unit: '%' });
  });

  it('grows once a percentage stop passes the natural domain', () => {
    expect(trackSpan([stop(pct(0)), stop(pct(140))]).value).toBeGreaterThan(140);
  });

  it('treats the track as pixel-based when any stop is in pixels', () => {
    expect(trackSpan([stop(pct(0)), stop(px(30))]).unit).toBe('px');
  });

  it('handles an empty list', () => {
    expect(trackSpan([])).toEqual({ value: 100, unit: '%' });
  });
});

describe('stopFraction', () => {
  it('places a stop proportionally along the track', () => {
    const span = { value: 20, unit: 'px' as const };

    expect(stopFraction(stop(px(0)), span)).toBe(0);
    expect(stopFraction(stop(px(10)), span)).toBe(0.5);
    expect(stopFraction(stop(px(20)), span)).toBe(1);
  });

  it('leaves the rightmost stop room to move in both directions', () => {
    const stops = [stop(px(0)), stop(px(20))];
    const span = trackSpan(stops);
    const rightmost = stops[1];

    expect(rightmost).toBeDefined();
    if (!rightmost) return;
    expect(stopFraction(rightmost, span)).toBeLessThan(1);
  });

  it('clamps a stop beyond the span', () => {
    expect(stopFraction(stop(px(40)), { value: 20, unit: 'px' })).toBe(1);
  });
});

describe('mixColors', () => {
  it('returns the endpoints exactly', () => {
    const a = makeColor(0.3, 0.1, 20);
    const b = makeColor(0.8, 0.2, 200);

    expect(mixColors(a, b, 0)).toEqual(a);
    expect(mixColors(a, b, 1)).toEqual(b);
  });

  it('takes the short way round the hue circle', () => {
    // 350 to 10 should pass through 0, not sweep back through 180.
    const mixed = mixColors(makeColor(0.5, 0.1, 350), makeColor(0.5, 0.1, 10), 0.5);

    expect(mixed.h).toBe(0);
  });

  it('interpolates alpha', () => {
    const mixed = mixColors(makeColor(0.5, 0.1, 0, 0), makeColor(0.5, 0.1, 0, 1), 0.25);

    expect(mixed.alpha).toBe(0.25);
  });
});

describe('colorAtFraction', () => {
  const stops: GradientStop[] = [
    stop(pct(0), makeColor(0.5, 0.2, 0)),
    stop(pct(100), makeColor(0.5, 0.2, 180)),
  ];

  it('returns the first colour before the first stop', () => {
    expect(colorAtFraction(stops, 0)).toEqual(stops[0]?.color);
  });

  it('returns the last colour after the last stop', () => {
    expect(colorAtFraction(stops, 1)).toEqual(stops[1]?.color);
  });

  it('blends between neighbours', () => {
    const middle = colorAtFraction(stops, 0.5);

    expect(middle.h).toBeCloseTo(90, 5);
  });

  it('produces a usable colour for an empty list', () => {
    expect(serializeColor(colorAtFraction([], 0.5), 'hex')).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('sortStops', () => {
  it('orders ascending without mutating the input', () => {
    const input = [stop(pct(80)), stop(pct(10)), stop(pct(50))];
    const sorted = sortStops(input);

    expect(sorted.map((s) => s.position.value)).toEqual([10, 50, 80]);
    expect(input.map((s) => s.position.value)).toEqual([80, 10, 50]);
  });
});

describe('stop limits', () => {
  it('requires two stops, which is what CSS demands', () => {
    expect(MIN_STOPS).toBe(2);
  });

  it('caps stops so a hostile pattern cannot be unbounded', () => {
    // Not a CSS limit — gradients may have any number of stops.
    expect(MAX_STOPS).toBe(64);
  });
});
