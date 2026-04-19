/**
 * Top-level `clusterAll` entry point. Consumers (the URL / image / PDF
 * extractors) pass in a raw token list produced by fusion and receive a
 * clustered, deduped, confidence-scored token list in return.
 *
 * This is deliberately pure: no I/O, no Claude calls. Semantic naming lives
 * in `@prism/intelligence` and runs AFTER clustering.
 */
import type {
  BorderToken,
  ColorToken,
  GradientToken,
  MotionToken,
  OpacityToken,
  RadiusToken,
  ShadowToken,
  SpacingToken,
  Token,
  TypographyToken,
} from '@prism/shared';
import { clusterColors, type ColorClusterOptions } from './cluster/colors.js';
import { clusterSpacing, type SpacingClusterOptions } from './cluster/spacing.js';
import { clusterTypography } from './cluster/typography.js';
import { clusterRadii } from './cluster/radii.js';
import { clusterShadows } from './cluster/shadows.js';

export interface ClusterAllOptions {
  color?: ColorClusterOptions;
  spacing?: SpacingClusterOptions;
}

export interface ClusterAllStats {
  inputCount: number;
  outputCount: number;
  perCategory: Record<Token['category'], { in: number; out: number }>;
  detectedSpacingBasePx?: number;
  spacingScaleCoverage?: number;
}

export interface ClusterAllResult {
  tokens: Token[];
  stats: ClusterAllStats;
}

function partition(tokens: Token[]): {
  colors: ColorToken[];
  typography: TypographyToken[];
  spacing: SpacingToken[];
  radii: RadiusToken[];
  shadows: ShadowToken[];
  borders: BorderToken[];
  gradients: GradientToken[];
  motion: MotionToken[];
  opacities: OpacityToken[];
  others: Token[];
} {
  const out = {
    colors: [] as ColorToken[],
    typography: [] as TypographyToken[],
    spacing: [] as SpacingToken[],
    radii: [] as RadiusToken[],
    shadows: [] as ShadowToken[],
    borders: [] as BorderToken[],
    gradients: [] as GradientToken[],
    motion: [] as MotionToken[],
    opacities: [] as OpacityToken[],
    others: [] as Token[],
  };
  for (const t of tokens) {
    switch (t.category) {
      case 'color':
        out.colors.push(t);
        break;
      case 'typography':
        out.typography.push(t);
        break;
      case 'spacing':
        out.spacing.push(t);
        break;
      case 'radius':
        out.radii.push(t);
        break;
      case 'shadow':
        out.shadows.push(t);
        break;
      case 'border':
        out.borders.push(t);
        break;
      case 'gradient':
        out.gradients.push(t);
        break;
      case 'motion':
        out.motion.push(t);
        break;
      case 'opacity':
        out.opacities.push(t);
        break;
      default:
        out.others.push(t);
    }
  }
  return out;
}

export function clusterAll(tokens: Token[], options: ClusterAllOptions = {}): ClusterAllResult {
  const p = partition(tokens);

  const colorResult = clusterColors(p.colors, options.color ?? {});
  const typoResult = clusterTypography(p.typography);
  const spacingResult = clusterSpacing(p.spacing, options.spacing ?? {});
  const radiusResult = clusterRadii(p.radii);
  const shadowResult = clusterShadows(p.shadows);

  const tokensOut: Token[] = [
    ...colorResult.tokens,
    ...typoResult.tokens,
    ...spacingResult.tokens,
    ...radiusResult.tokens,
    ...shadowResult.tokens,
    ...p.borders,
    ...p.gradients,
    ...p.motion,
    ...p.opacities,
    ...p.others,
  ];

  const perCategory: ClusterAllStats['perCategory'] = {
    color: { in: p.colors.length, out: colorResult.tokens.length },
    typography: { in: p.typography.length, out: typoResult.tokens.length },
    spacing: { in: p.spacing.length, out: spacingResult.tokens.length },
    radius: { in: p.radii.length, out: radiusResult.tokens.length },
    shadow: { in: p.shadows.length, out: shadowResult.tokens.length },
    border: { in: p.borders.length, out: p.borders.length },
    gradient: { in: p.gradients.length, out: p.gradients.length },
    motion: { in: p.motion.length, out: p.motion.length },
    opacity: { in: p.opacities.length, out: p.opacities.length },
    breakpoint: { in: 0, out: 0 },
    'z-index': { in: 0, out: 0 },
    filter: { in: 0, out: 0 },
  };

  return {
    tokens: tokensOut,
    stats: {
      inputCount: tokens.length,
      outputCount: tokensOut.length,
      perCategory,
      ...(spacingResult.detectedBasePx !== undefined
        ? { detectedSpacingBasePx: spacingResult.detectedBasePx }
        : {}),
      ...(spacingResult.scaleCoverage !== undefined
        ? { spacingScaleCoverage: spacingResult.scaleCoverage }
        : {}),
    },
  };
}
