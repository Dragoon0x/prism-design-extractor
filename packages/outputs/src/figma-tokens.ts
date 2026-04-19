/**
 * Figma Tokens Studio schema.
 *
 * Differs from W3C DTCG:
 *   - `value` / `type` instead of `$value` / `$type`.
 *   - Tokens are grouped under a "set" (we use "global").
 *   - Spacing / dimension values are BARE NUMBERS as strings ("16", not "16px").
 *   - Typography values use a flat object with fontFamily / fontSize / etc.
 *   - A top-level `$themes` array and `$metadata.tokenSetOrder`.
 *
 * Spec: https://docs.tokens.studio/
 */
import type { Artifact, CanonicalExtraction } from '@prism/shared';
import { jsonArtifact } from './artifact.js';
import { colorCss, keyedTokens, radiusCss, shadowCss, tokensByCategory, typographyCss } from './shared.js';

type LeafValue = string | number | Record<string, string | number>;

type LeafToken = {
  value: LeafValue;
  type: string;
  description?: string;
};

type TokenGroup = { [name: string]: LeafToken };

interface FigmaTokensTree {
  global: Record<string, TokenGroup>;
  $themes: unknown[];
  $metadata: {
    tokenSetOrder: string[];
  };
}

function bareNumber(cssLength: string): string {
  const m = /^(-?\d*\.?\d+)/.exec(cssLength);
  return m?.[1] ?? cssLength;
}

export function generateFigmaTokensJson(extraction: CanonicalExtraction): Artifact {
  const t = tokensByCategory(extraction);
  const global: Record<string, TokenGroup> = {};

  const colors: TokenGroup = {};
  for (const { key, value } of keyedTokens(t.colors)) {
    colors[key] = { value: colorCss(value.value), type: 'color' };
  }
  if (Object.keys(colors).length > 0) global.color = colors;

  const spacing: TokenGroup = {};
  for (const { key, value } of keyedTokens(t.spacing)) {
    const cssLen = `${value.value.px ?? value.value.value}${value.value.unit}`;
    spacing[key] = { value: bareNumber(cssLen), type: 'spacing' };
  }
  if (Object.keys(spacing).length > 0) global.spacing = spacing;

  const radii: TokenGroup = {};
  for (const { key, value } of keyedTokens(t.radii)) {
    radii[key] = { value: bareNumber(radiusCss(value)), type: 'borderRadius' };
  }
  if (Object.keys(radii).length > 0) global.borderRadius = radii;

  const shadows: TokenGroup = {};
  for (const { key, value } of keyedTokens(t.shadows)) {
    const layers = value.value.layers.map((layer) => ({
      x: bareNumber(`${layer.offsetX.px ?? layer.offsetX.value}px`),
      y: bareNumber(`${layer.offsetY.px ?? layer.offsetY.value}px`),
      blur: bareNumber(`${layer.blur.px ?? layer.blur.value}px`),
      spread: bareNumber(`${layer.spread.px ?? layer.spread.value}px`),
      color:
        layer.color.alpha === 1
          ? layer.color.hex
          : `${layer.color.hex}${Math.round(layer.color.alpha * 255).toString(16).padStart(2, '0')}`,
      type: layer.inset ? 'innerShadow' : 'dropShadow',
    }));
    shadows[key] = {
      value: (layers.length === 1 ? layers[0] : layers) as unknown as LeafValue,
      type: 'boxShadow',
    };
    // Keep the un-prefixed `shadowCss` around for description usability.
    shadows[key].description = shadowCss(value);
  }
  if (Object.keys(shadows).length > 0) global.boxShadow = shadows;

  const typography: TokenGroup = {};
  for (const { key, value } of keyedTokens(t.typography)) {
    const v = typographyCss(value);
    typography[key] = {
      value: {
        fontFamily: v.family.replace(/^"|"$/g, ''),
        fontSize: bareNumber(v.size),
        fontWeight: v.weight,
        ...(v.lineHeight !== undefined ? { lineHeight: bareNumber(v.lineHeight) } : {}),
        ...(v.letterSpacing !== undefined ? { letterSpacing: bareNumber(v.letterSpacing) } : {}),
      },
      type: 'typography',
    };
  }
  if (Object.keys(typography).length > 0) global.typography = typography;

  const tree: FigmaTokensTree = {
    global,
    $themes: [],
    $metadata: { tokenSetOrder: ['global'] },
  };

  return jsonArtifact('figma-tokens-json', 'figma-tokens.json', tree);
}
