/**
 * Normalization helpers — turn messy CSS-computed values into the canonical
 * forms used by clustering.
 */
import type { LengthValue, TypographyToken } from '@prism/shared';

/** Strip quotes + extra whitespace + fallback siblings from a CSS `font-family` string. */
export function normalizeFontFamily(cssFamily: string): string {
  const first = cssFamily.split(',')[0] ?? cssFamily;
  return first
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .trim();
}

/** Extract the fallback stack (everything after the primary family). */
export function normalizeFontFallback(cssFamily: string): string[] {
  return cssFamily
    .split(',')
    .slice(1)
    .map((f) => f.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean);
}

/** Convert a LengthValue to pixels (best effort). Returns `undefined` if unit is unresolvable. */
export function lengthToPx(length: LengthValue): number | undefined {
  if (length.px !== undefined) return length.px;
  if (length.unit === 'px') return length.value;
  if (length.unit === 'rem' || length.unit === 'em') return length.value * 16;
  if (length.unit === 'pt') return length.value * (96 / 72);
  return undefined;
}

/** Round a px value to a sensible 2-decimal precision (so 15.9999 → 16, 13.5 → 13.5). */
export function roundPx(px: number): number {
  return Math.round(px * 100) / 100;
}

/**
 * Normalize a weight name or numeric weight into the standard 100-900 integer.
 * CSS `normal` → 400, `bold` → 700.
 */
export function normalizeWeight(value: string | number): number {
  if (typeof value === 'number') return value;
  const v = value.trim().toLowerCase();
  switch (v) {
    case 'normal':
      return 400;
    case 'bold':
      return 700;
    case 'lighter':
      return 300;
    case 'bolder':
      return 700;
    default: {
      const n = Number.parseInt(v, 10);
      return Number.isFinite(n) ? n : 400;
    }
  }
}

/** Bucket a px font-size into a small-N rounded value (1px precision for large sizes). */
export function bucketFontSizePx(px: number): number {
  if (px < 12) return roundPx(px);
  return Math.round(px);
}

/** Collapse cluster tags down to a deduped, sorted list. */
export function mergeTags(inputs: Token[]): string[] {
  const set = new Set<string>();
  for (const t of inputs) for (const tag of t.tags) set.add(tag);
  return [...set].sort();
}

// Re-type narrowing used above — avoids a circular import.
type Token = { tags: string[] };

/** Represents a typography token's key shape used for clustering. */
export interface TypoClusterKey {
  family: string;
  sizePx: number;
  weight: number;
}

export function makeTypoClusterKey(t: TypographyToken): TypoClusterKey | undefined {
  const sizePx = lengthToPx(t.value.size);
  if (sizePx === undefined) return undefined;
  return {
    family: t.value.family,
    sizePx: bucketFontSizePx(sizePx),
    weight: t.value.weight,
  };
}
