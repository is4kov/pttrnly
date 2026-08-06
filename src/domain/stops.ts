import { makeColor, type Color } from './color';
import { LIMITS } from './validate';
import type { Length, LengthUnit } from './length';
import type { GradientStop } from './types';

/** Pure helpers for reasoning about a gradient's stop list. */

/** CSS needs at least two colour stops for a gradient to be valid. */
export const MIN_STOPS = LIMITS.stopsPerLayer.min;

/**
 * Not a CSS limit — gradients may have any number of stops. This is our own
 * guard so a share link cannot ship a pattern that takes minutes to paint.
 */
export const MAX_STOPS = LIMITS.stopsPerLayer.max;

/**
 * Rounds up to the next multiple of ten and adds a step of headroom, so the
 * span only changes when a stop crosses a band rather than on every pixel of
 * a drag.
 */
function withHeadroom(value: number): number {
  return Math.max(Math.ceil(value / 10) * 10 + 10, 20);
}

/**
 * The stop bar is a single track, but offsets may be px or %.
 *
 * The span must NOT simply track the largest offset: that makes the scale
 * depend on the data being edited, so dragging the rightmost stop left shrinks
 * the track underneath it and the handle never appears to move. Percentages
 * therefore hold a floor of 100 — their natural domain — and pixels round up
 * with headroom so the rightmost stop always has somewhere to go.
 */
export function trackSpan(stops: readonly GradientStop[]): Length {
  let largest = 0;
  let unit: Length['unit'] = '%';
  let seen = false;

  for (const stop of stops) {
    if (!seen || stop.position.value > largest) {
      largest = stop.position.value;
      seen = true;
    }
    // A single px stop makes the whole track pixel-based.
    if (stop.position.unit === 'px') unit = 'px';
  }

  // Percentages have a natural domain of 0-100, so the bar shows the gradient
  // exactly until a stop genuinely exceeds it.
  if (unit === '%') return { value: largest <= 100 ? 100 : withHeadroom(largest), unit };
  return { value: withHeadroom(largest), unit };
}

/** Position along the track, 0–1. */
export function stopFraction(stop: GradientStop, span: Length): number {
  if (span.value === 0) return 0;
  return clamp01(stop.position.value / span.value);
}

export function fractionToLength(fraction: number, unit: LengthUnit, span: Length): Length {
  return { value: round2(clamp01(fraction) * span.value), unit };
}

const clamp01 = (value: number): number => (value < 0 ? 0 : value > 1 ? 1 : value);

const round2 = (value: number): number => Math.round(value * 100) / 100;

/** Straight-line interpolation in OKLCH, matching how the browser reads `in oklch`. */
export function mixColors(from: Color, to: Color, amount: number): Color {
  const t = clamp01(amount);

  // Hue takes the shorter way round, so red→magenta does not detour through green.
  let deltaHue = to.h - from.h;
  if (deltaHue > 180) deltaHue -= 360;
  if (deltaHue < -180) deltaHue += 360;

  return makeColor(
    from.l + (to.l - from.l) * t,
    from.c + (to.c - from.c) * t,
    from.h + deltaHue * t,
    from.alpha + (to.alpha - from.alpha) * t,
  );
}

/** The colour a new stop should take when inserted partway along the gradient. */
export function colorAtFraction(stops: readonly GradientStop[], fraction: number): Color {
  const span = trackSpan(stops);
  const ordered = [...stops].sort((a, b) => a.position.value - b.position.value);

  const first = ordered[0];
  const last = ordered[ordered.length - 1];
  if (!first || !last) return makeColor(0.5, 0.1, 250);

  if (fraction <= stopFraction(first, span)) return first.color;
  if (fraction >= stopFraction(last, span)) return last.color;

  for (let i = 0; i < ordered.length - 1; i += 1) {
    const left = ordered[i];
    const right = ordered[i + 1];
    if (!left || !right) continue;

    const leftFraction = stopFraction(left, span);
    const rightFraction = stopFraction(right, span);

    if (fraction >= leftFraction && fraction <= rightFraction) {
      const gap = rightFraction - leftFraction;
      const local = gap === 0 ? 0 : (fraction - leftFraction) / gap;
      return mixColors(left.color, right.color, local);
    }
  }

  return last.color;
}

/** Keeps the list in ascending order, which is how CSS reads it. */
export function sortStops(stops: readonly GradientStop[]): GradientStop[] {
  return [...stops].sort((a, b) => a.position.value - b.position.value);
}
