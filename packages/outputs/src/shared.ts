/**
 * Formatting helpers shared across generators.
 */
import type {
  CanonicalExtraction,
  ColorToken,
  LengthValue,
  RadiusToken,
  ShadowToken,
  SpacingToken,
  Token,
  TypographyToken,
} from '@prism/shared';

/**
 * Choose the leaf token "key" used for output naming:
 *   1. `semanticRole` (set by intelligence) → kebab-case
 *   2. `name` → kebab-case
 *   3. `${category}-${index}` fallback
 */
export function tokenKey(token: Token, fallbackIndex: number): string {
  if (token.semanticRole) return toKebab(token.semanticRole);
  if (token.name) return toKebab(token.name);
  return `${token.category}-${fallbackIndex + 1}`;
}

export function toKebab(input: string): string {
  return input
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

/** Render a LengthValue like `16px` or `1rem`. */
export function lengthCss(v: LengthValue): string {
  if (v.unit === 'px' && v.px !== undefined) return `${stripZero(v.px)}px`;
  return `${stripZero(v.value)}${v.unit}`;
}

/** Trim trailing zeroes so `16.00` becomes `16` and `1.50` becomes `1.5`. */
function stripZero(n: number): string {
  if (Number.isInteger(n)) return `${n}`;
  return `${Number(n.toFixed(4))}`;
}

/** Render a color as `#RRGGBB` or `#RRGGBBAA` if alpha < 1. */
export function colorCss(c: ColorToken['value']): string {
  if (c.alpha >= 0.999) return c.hex;
  const aa = Math.round(c.alpha * 255).toString(16).padStart(2, '0');
  return `${c.hex}${aa}`;
}

/** Render a shadow token as a CSS `box-shadow` (or `text-shadow`) declaration. */
export function shadowCss(t: ShadowToken): string {
  return t.value.layers
    .map((layer) => {
      const parts: string[] = [
        lengthCss(layer.offsetX),
        lengthCss(layer.offsetY),
        lengthCss(layer.blur),
      ];
      if (t.value.target !== 'text-shadow') parts.push(lengthCss(layer.spread));
      parts.push(colorCss(layer.color));
      if (layer.inset) parts.unshift('inset');
      return parts.join(' ');
    })
    .join(', ');
}

/** Render a radius token as CSS. */
export function radiusCss(t: RadiusToken): string {
  const v = t.value;
  if ('kind' in v && v.kind === 'asymmetric') {
    return [v.topLeft, v.topRight, v.bottomRight, v.bottomLeft].map(lengthCss).join(' ');
  }
  return lengthCss(v as LengthValue);
}

/** Render a typography token as a CSS shorthand `font` value (best-effort). */
export function typographyCss(t: TypographyToken): {
  family: string;
  size: string;
  weight: number;
  lineHeight?: string | undefined;
  letterSpacing?: string | undefined;
} {
  const v = t.value;
  const family = [v.family, ...v.fallbackStack]
    .map((f) => (/\s/.test(f) ? `"${f}"` : f))
    .join(', ');
  let lineHeight: string | undefined;
  if (v.lineHeight?.kind === 'unitless') lineHeight = `${v.lineHeight.value}`;
  else if (v.lineHeight?.kind === 'length') lineHeight = lengthCss(v.lineHeight.value);
  const letterSpacing = v.letterSpacing ? lengthCss(v.letterSpacing) : undefined;
  return {
    family,
    size: lengthCss(v.size),
    weight: v.weight,
    ...(lineHeight !== undefined ? { lineHeight } : {}),
    ...(letterSpacing !== undefined ? { letterSpacing } : {}),
  };
}

/** Partition a flat canonical extraction into per-category token arrays, sorted. */
export function tokensByCategory(extraction: CanonicalExtraction): {
  colors: ColorToken[];
  typography: TypographyToken[];
  spacing: SpacingToken[];
  radii: RadiusToken[];
  shadows: ShadowToken[];
  gradients: Token[];
  borders: Token[];
  motion: Token[];
  opacities: Token[];
  breakpoints: Token[];
  zIndices: Token[];
  filters: Token[];
} {
  const out = {
    colors: [] as ColorToken[],
    typography: [] as TypographyToken[],
    spacing: [] as SpacingToken[],
    radii: [] as RadiusToken[],
    shadows: [] as ShadowToken[],
    gradients: [] as Token[],
    borders: [] as Token[],
    motion: [] as Token[],
    opacities: [] as Token[],
    breakpoints: [] as Token[],
    zIndices: [] as Token[],
    filters: [] as Token[],
  };
  for (const t of extraction.tokens) {
    switch (t.category) {
      case 'color': out.colors.push(t); break;
      case 'typography': out.typography.push(t); break;
      case 'spacing': out.spacing.push(t); break;
      case 'radius': out.radii.push(t); break;
      case 'shadow': out.shadows.push(t); break;
      case 'gradient': out.gradients.push(t); break;
      case 'border': out.borders.push(t); break;
      case 'motion': out.motion.push(t); break;
      case 'opacity': out.opacities.push(t); break;
      case 'breakpoint': out.breakpoints.push(t); break;
      case 'z-index': out.zIndices.push(t); break;
      case 'filter': out.filters.push(t); break;
    }
  }
  // Stable ordering: usage desc within each bucket, except typography which
  // is already size-sorted by the clusterer.
  out.colors.sort((a, b) => b.usageCount - a.usageCount);
  out.spacing.sort((a, b) => (a.value.px ?? 0) - (b.value.px ?? 0));
  out.radii.sort((a, b) => {
    const ap = 'kind' in a.value ? 0 : (a.value as LengthValue).px ?? 0;
    const bp = 'kind' in b.value ? 0 : (b.value as LengthValue).px ?? 0;
    return ap - bp;
  });
  out.shadows.sort((a, b) => b.usageCount - a.usageCount);
  return out;
}

/** Ensure leaf keys are unique within a group by suffixing `-2`, `-3`, … on collision. */
export function dedupeKeys<T>(items: { key: string; value: T }[]): { key: string; value: T }[] {
  const seen = new Map<string, number>();
  return items.map(({ key, value }) => {
    const prior = seen.get(key);
    const unique = prior === undefined ? key : `${key}-${prior + 1}`;
    seen.set(key, (prior ?? 0) + 1);
    return { key: unique, value };
  });
}

export function keyedTokens<T extends Token>(tokens: T[]): { key: string; value: T }[] {
  return dedupeKeys(tokens.map((t, i) => ({ key: tokenKey(t, i), value: t })));
}
