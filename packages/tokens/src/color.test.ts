import { describe, expect, it } from 'vitest';
import { contrastRatio, deltaE, parseColor } from './color.js';

describe('parseColor', () => {
  it('parses hex to rgb/hsl/oklch with alpha 1', () => {
    const c = parseColor('#3B82F6');
    expect(c.hex).toBe('#3b82f6');
    expect(c.alpha).toBe(1);
    expect(c.rgb).toEqual({ r: 59, g: 130, b: 246 });
    expect(c.hsl.h).toBeGreaterThan(200);
    expect(c.hsl.h).toBeLessThan(230);
    expect(c.oklch.l).toBeGreaterThan(0);
    expect(c.oklch.l).toBeLessThan(1);
  });

  it('parses rgb() strings', () => {
    const c = parseColor('rgb(0, 0, 0)');
    expect(c.hex).toBe('#000000');
    expect(c.rgb).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('parses named colors', () => {
    const c = parseColor('tomato');
    expect(c.rgb.r).toBeGreaterThan(200);
  });
});

describe('deltaE', () => {
  it('returns 0 for identical colors', () => {
    const c = parseColor('#3B82F6');
    expect(deltaE(c, c)).toBeCloseTo(0, 2);
  });

  it('detects near-duplicates under the clustering threshold (2.5)', () => {
    const a = parseColor('#3B82F6');
    const b = parseColor('#3C82F5'); // one-step RGB nudge
    expect(deltaE(a, b)).toBeLessThan(2.5);
  });

  it('detects clearly distinct colors', () => {
    const a = parseColor('#3B82F6'); // blue
    const b = parseColor('#EF4444'); // red
    expect(deltaE(a, b)).toBeGreaterThan(40);
  });
});

describe('contrastRatio', () => {
  it('white-on-black is 21', () => {
    const white = parseColor('#ffffff');
    const black = parseColor('#000000');
    expect(contrastRatio(white, black)).toBeCloseTo(21, 0);
  });

  it('identical colors return 1', () => {
    const c = parseColor('#888888');
    expect(contrastRatio(c, c)).toBeCloseTo(1, 1);
  });

  it('order-independent', () => {
    const a = parseColor('#3B82F6');
    const b = parseColor('#ffffff');
    expect(contrastRatio(a, b)).toBeCloseTo(contrastRatio(b, a), 5);
  });
});
