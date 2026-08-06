import { clampNumber, LIMITS } from './validate';
import { formatNumber } from './color';

/**
 * A CSS `<length-percentage>`. Used for background-size, background-position,
 * gradient stop offsets and radial radii — anywhere CSS accepts either unit.
 */

export type LengthUnit = 'px' | '%';

export const LENGTH_UNITS: readonly LengthUnit[] = ['px', '%'];

export type Length = { value: number; unit: LengthUnit };

/** Narrower than Length, for the places CSS only accepts pixels. */
export type PxLength = { value: number; unit: 'px' };

export const px = (value: number): PxLength => ({ value, unit: 'px' });
export const pct = (value: number): Length => ({ value, unit: '%' });

function limitFor(unit: LengthUnit): { min: number; max: number } {
  return unit === 'px' ? LIMITS.px : LIMITS.percent;
}

/** Clamps into the range allowed for the unit. Non-finite values collapse to the minimum. */
export function clampLength(length: Length): Length {
  const { min, max } = limitFor(length.unit);
  return { value: clampNumber(length.value, min, max), unit: length.unit };
}

/** Clamps into a non-negative range, for properties where negatives are invalid. */
export function clampNonNegative(length: Length): Length {
  const { max } = limitFor(length.unit);
  return { value: clampNumber(length.value, 0, max), unit: length.unit };
}

/**
 * Always emits the unit — `0px`, never a bare `0` — so output stays byte-stable
 * regardless of how a value was produced.
 */
export function formatLength(length: Length): string {
  const clamped = clampLength(length);
  return `${formatNumber(clamped.value, 2)}${clamped.unit}`;
}

export function formatNonNegativeLength(length: Length): string {
  const clamped = clampNonNegative(length);
  return `${formatNumber(clamped.value, 2)}${clamped.unit}`;
}
