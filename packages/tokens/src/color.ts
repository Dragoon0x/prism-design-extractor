/**
 * Color conversions and perceptual distance (ΔE2000).
 * Used by the clustering stage to collapse near-identical colors.
 *
 * Built on `culori` — it ships every colorspace we need and is tree-shakable.
 */
import { converter, differenceCiede2000, formatHex, parse, type Color } from 'culori';
import type { ColorValue } from '@prism/shared';

const toRgb = converter('rgb');
const toHsl = converter('hsl');
const toOklch = converter('oklch');
const deltaE2000 = differenceCiede2000();

function must<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`[tokens/color] failed to parse ${what}`);
  return value;
}

/**
 * Parse any CSS color string (`"#fff"`, `"rgb(0,0,0)"`, `"oklch(…)"`, named
 * colors) into our canonical ColorValue shape. Throws on invalid input.
 */
export function parseColor(input: string): ColorValue {
  const parsed = must<Color>(parse(input), `color "${input}"`);
  const rgb = must(toRgb(parsed), `rgb for "${input}"`);
  const hsl = must(toHsl(parsed), `hsl for "${input}"`);
  const oklch = must(toOklch(parsed), `oklch for "${input}"`);
  const hex = formatHex({ ...parsed, alpha: 1 }) ?? '#000000';
  return {
    hex: hex.toLowerCase(),
    rgb: {
      r: Math.round((rgb.r ?? 0) * 255),
      g: Math.round((rgb.g ?? 0) * 255),
      b: Math.round((rgb.b ?? 0) * 255),
    },
    hsl: {
      h: Math.round(hsl.h ?? 0),
      s: Math.round((hsl.s ?? 0) * 100),
      l: Math.round((hsl.l ?? 0) * 100),
    },
    oklch: {
      l: Number((oklch.l ?? 0).toFixed(4)),
      c: Number((oklch.c ?? 0).toFixed(4)),
      h: Number((oklch.h ?? 0).toFixed(2)),
    },
    alpha: parsed.alpha ?? 1,
  };
}

/**
 * Perceptual distance between two colors in ΔE2000 units.
 * Values < 1 are imperceptible, < 2.5 are "just noticeable" (our clustering threshold),
 * > 10 are clearly distinct.
 */
export function deltaE(a: ColorValue, b: ColorValue): number {
  return deltaE2000(a.hex, b.hex);
}

/**
 * WCAG 2.x relative luminance for contrast calculations.
 */
export function relativeLuminance({ rgb }: ColorValue): number {
  const srgb = [rgb.r, rgb.g, rgb.b].map((ch) => {
    const v = ch / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0]! + 0.7152 * srgb[1]! + 0.0722 * srgb[2]!;
}

export function contrastRatio(a: ColorValue, b: ColorValue): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
