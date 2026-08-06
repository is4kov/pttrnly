import { describe, expect, it } from 'vitest';
import { clampNumber, isAllowedImageUrl } from './validate';

describe('clampNumber', () => {
  it('clamps to the given range', () => {
    expect(clampNumber(5, 0, 10)).toBe(5);
    expect(clampNumber(-5, 0, 10)).toBe(0);
    expect(clampNumber(50, 0, 10)).toBe(10);
  });

  it('falls back to the minimum for non-finite input', () => {
    expect(clampNumber(Number.NaN, 0, 10)).toBe(0);
    expect(clampNumber(Number.POSITIVE_INFINITY, 0, 10)).toBe(0);
  });
});

describe('isAllowedImageUrl', () => {
  it('accepts https URLs', () => {
    expect(isAllowedImageUrl('https://example.com/a.png')).toBe(true);
    expect(isAllowedImageUrl('https://example.com/a.png?v=2')).toBe(true);
  });

  it('accepts base64 data URLs for image types', () => {
    expect(isAllowedImageUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    expect(isAllowedImageUrl('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toBe(true);
  });

  it('rejects dangerous and unsupported schemes', () => {
    expect(isAllowedImageUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedImageUrl('JavaScript:alert(1)')).toBe(false);
    expect(isAllowedImageUrl('blob:https://example.com/abc')).toBe(false);
    expect(isAllowedImageUrl('http://example.com/a.png')).toBe(false);
    expect(isAllowedImageUrl('file:///etc/passwd')).toBe(false);
    expect(isAllowedImageUrl('/relative/a.png')).toBe(false);
    expect(isAllowedImageUrl('example.com/a.png')).toBe(false);
  });

  it('rejects non-image data URLs', () => {
    expect(isAllowedImageUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe(false);
    expect(isAllowedImageUrl('data:image/png,notbase64')).toBe(false);
  });

  it('rejects characters that could break out of url()', () => {
    expect(isAllowedImageUrl('https://example.com/a.png")')).toBe(false);
    expect(isAllowedImageUrl("https://example.com/a'.png")).toBe(false);
    expect(isAllowedImageUrl('https://example.com/a(1).png')).toBe(false);
    expect(isAllowedImageUrl('https://example.com/a\\.png')).toBe(false);
    expect(isAllowedImageUrl('https://example.com/a\n.png')).toBe(false);
    expect(isAllowedImageUrl('https://example.com/a .png')).toBe(false);
  });

  it('rejects empty and oversized URLs', () => {
    expect(isAllowedImageUrl('')).toBe(false);
    expect(isAllowedImageUrl(`https://example.com/${'a'.repeat(5000)}.png`)).toBe(false);
  });
});
