/**
 * Token schemas — the heart of the canonical tree.
 *
 * Every token shares a common `baseTokenSchema` (id, name, confidence,
 * usage count, evidence). Type-specific schemas extend the base with a
 * category discriminator and a structured `value`.
 *
 * Extractors emit tokens into this shape. The tokens package does clustering
 * and confidence math over this shape. Output generators read from this shape.
 * The intelligence package is the ONLY package allowed to set `semanticRole`.
 */
import { z } from 'zod';
import {
  colorValueSchema,
  durationValueSchema,
  easingValueSchema,
  lengthValueSchema,
} from './primitives.js';
import { evidenceItemSchema } from './evidence.js';

// ---------------------------------------------------------------------------
// Base (common to every token)
// ---------------------------------------------------------------------------

export const baseTokenSchema = z.object({
  /** Stable hash of (category, normalizedValue). Unchanged across re-extractions of the same value. */
  id: z.string().min(1),
  /** Machine-friendly name. May start as `color-1` until the intelligence layer names it. */
  name: z.string().min(1),
  /** Semantic role assigned by the intelligence layer (`primary`, `surface`, `destructive`, …). */
  semanticRole: z.string().optional(),
  /** Confidence 0–1 that this token is real (not noise, duplicate, or a vision hallucination). */
  confidence: z.number().min(0).max(1),
  /** How many distinct elements/selectors/pages use this token. Used for clustering + ordering. */
  usageCount: z.number().int().nonnegative(),
  /** Evidence items justifying this token. Never empty. */
  evidence: z.array(evidenceItemSchema).min(1),
  /** Cluster id — tokens with the same cluster id were merged by the clustering stage. */
  clusterId: z.string().optional(),
  /** Free-form tags set during extraction (e.g. "from-css-variable", "from-vision-only"). */
  tags: z.array(z.string()).default([]),
});

// ---------------------------------------------------------------------------
// Color
// ---------------------------------------------------------------------------

export const contrastPairSchema = z.object({
  otherTokenId: z.string(),
  ratio: z.number().positive(),
  passesAA_normal: z.boolean(),
  passesAA_large: z.boolean(),
  passesAAA_normal: z.boolean(),
  passesAAA_large: z.boolean(),
});
export type ContrastPair = z.infer<typeof contrastPairSchema>;

export const colorTokenSchema = baseTokenSchema.extend({
  category: z.literal('color'),
  value: colorValueSchema,
  /** Contrast of this color against other color tokens; computed during the audit stage. */
  contrast: z.array(contrastPairSchema).default([]),
});
export type ColorToken = z.infer<typeof colorTokenSchema>;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export const fontWeightNameSchema = z.enum([
  'thin',
  'extralight',
  'light',
  'normal',
  'medium',
  'semibold',
  'bold',
  'extrabold',
  'black',
]);

export const fontSourceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('google'),
    family: z.string(),
    url: z.string().url(),
  }),
  z.object({
    kind: z.literal('self-hosted'),
    family: z.string(),
    url: z.string(),
    format: z.enum(['woff2', 'woff', 'ttf', 'otf', 'variable']),
  }),
  z.object({
    kind: z.literal('system'),
    family: z.string(),
  }),
  z.object({
    kind: z.literal('unknown'),
    family: z.string(),
  }),
]);
export type FontSource = z.infer<typeof fontSourceSchema>;

export const typographyValueSchema = z.object({
  /** Primary family only. Fallback stack is stored separately so we can re-generate CSS correctly. */
  family: z.string(),
  /** Fallback stack in order, WITHOUT the primary family. */
  fallbackStack: z.array(z.string()).default([]),
  weight: z.number().int().min(1).max(1000),
  weightName: fontWeightNameSchema.optional(),
  size: lengthValueSchema,
  lineHeight: z
    .union([
      z.object({ kind: z.literal('unitless'), value: z.number().positive() }),
      z.object({ kind: z.literal('length'), value: lengthValueSchema }),
      z.object({ kind: z.literal('normal') }),
    ])
    .optional(),
  letterSpacing: lengthValueSchema.optional(),
  textTransform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']).default('none'),
  textDecoration: z.enum(['none', 'underline', 'line-through', 'overline']).default('none'),
  fontStyle: z.enum(['normal', 'italic', 'oblique']).default('normal'),
  /** Variable-font axes settings, e.g. `{ wght: 425, slnt: -6 }`. */
  fontVariationSettings: z.record(z.string(), z.number()).optional(),
  /** Source of the primary family (google / self-hosted / system / unknown). */
  source: fontSourceSchema,
});
export type TypographyValue = z.infer<typeof typographyValueSchema>;

export const typographyTokenSchema = baseTokenSchema.extend({
  category: z.literal('typography'),
  value: typographyValueSchema,
});
export type TypographyToken = z.infer<typeof typographyTokenSchema>;

// ---------------------------------------------------------------------------
// Spacing
// ---------------------------------------------------------------------------

export const spacingTokenSchema = baseTokenSchema.extend({
  category: z.literal('spacing'),
  value: lengthValueSchema,
  /**
   * Role the spacing value plays in the detected scale, if any.
   * `scale-step` means it belongs to the detected (e.g. 4pt or 8pt) scale.
   * `gutter` / `container` mean layout-specific roles.
   */
  spacingRole: z.enum(['scale-step', 'gutter', 'container', 'ad-hoc']).default('ad-hoc'),
  /** The detected base unit of the scale (e.g. 4 or 8 px). */
  scaleBasePx: z.number().positive().optional(),
  /** Multiple of scaleBasePx, if on-scale. */
  scaleMultiple: z.number().optional(),
});
export type SpacingToken = z.infer<typeof spacingTokenSchema>;

// ---------------------------------------------------------------------------
// Radius
// ---------------------------------------------------------------------------

export const radiusValueSchema = z.union([
  lengthValueSchema,
  z.object({
    kind: z.literal('asymmetric'),
    topLeft: lengthValueSchema,
    topRight: lengthValueSchema,
    bottomRight: lengthValueSchema,
    bottomLeft: lengthValueSchema,
  }),
]);
export type RadiusValue = z.infer<typeof radiusValueSchema>;

export const radiusTokenSchema = baseTokenSchema.extend({
  category: z.literal('radius'),
  value: radiusValueSchema,
});
export type RadiusToken = z.infer<typeof radiusTokenSchema>;

// ---------------------------------------------------------------------------
// Shadow
// ---------------------------------------------------------------------------

export const shadowLayerSchema = z.object({
  offsetX: lengthValueSchema,
  offsetY: lengthValueSchema,
  blur: lengthValueSchema,
  spread: lengthValueSchema,
  color: colorValueSchema,
  inset: z.boolean().default(false),
});
export type ShadowLayer = z.infer<typeof shadowLayerSchema>;

export const shadowValueSchema = z.object({
  /** A single shadow token may represent a STACK of layered box-shadows. */
  layers: z.array(shadowLayerSchema).min(1),
  /** Which CSS property this represents. */
  target: z.enum(['box-shadow', 'drop-shadow', 'text-shadow']),
});
export type ShadowValue = z.infer<typeof shadowValueSchema>;

export const shadowTokenSchema = baseTokenSchema.extend({
  category: z.literal('shadow'),
  value: shadowValueSchema,
});
export type ShadowToken = z.infer<typeof shadowTokenSchema>;

// ---------------------------------------------------------------------------
// Border
// ---------------------------------------------------------------------------

export const borderStyleSchema = z.enum([
  'solid',
  'dashed',
  'dotted',
  'double',
  'groove',
  'ridge',
  'inset',
  'outset',
  'none',
  'hidden',
]);

export const borderValueSchema = z.object({
  width: lengthValueSchema,
  style: borderStyleSchema,
  color: colorValueSchema,
});
export type BorderValue = z.infer<typeof borderValueSchema>;

export const borderTokenSchema = baseTokenSchema.extend({
  category: z.literal('border'),
  value: borderValueSchema,
});
export type BorderToken = z.infer<typeof borderTokenSchema>;

// ---------------------------------------------------------------------------
// Gradient
// ---------------------------------------------------------------------------

export const gradientStopSchema = z.object({
  color: colorValueSchema,
  /** Position along the gradient, 0–1, or undefined to let the CSS engine auto-space. */
  position: z.number().min(0).max(1).optional(),
});

export const gradientValueSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('linear'),
    angleDeg: z.number(),
    stops: z.array(gradientStopSchema).min(2),
    repeating: z.boolean().default(false),
  }),
  z.object({
    kind: z.literal('radial'),
    shape: z.enum(['circle', 'ellipse']),
    position: z.enum(['center', 'top', 'bottom', 'left', 'right']).default('center'),
    stops: z.array(gradientStopSchema).min(2),
    repeating: z.boolean().default(false),
  }),
  z.object({
    kind: z.literal('conic'),
    fromDeg: z.number().default(0),
    stops: z.array(gradientStopSchema).min(2),
  }),
]);
export type GradientValue = z.infer<typeof gradientValueSchema>;

export const gradientTokenSchema = baseTokenSchema.extend({
  category: z.literal('gradient'),
  value: gradientValueSchema,
});
export type GradientToken = z.infer<typeof gradientTokenSchema>;

// ---------------------------------------------------------------------------
// Motion (transitions, animations, keyframes)
// ---------------------------------------------------------------------------

export const motionValueSchema = z.object({
  duration: durationValueSchema,
  delay: durationValueSchema.default({ ms: 0 }),
  easing: easingValueSchema,
  /** Comma-separated CSS property list this timing is applied to (e.g. "opacity,transform"). */
  property: z.string().default('all'),
});
export type MotionValue = z.infer<typeof motionValueSchema>;

export const motionTokenSchema = baseTokenSchema.extend({
  category: z.literal('motion'),
  value: motionValueSchema,
});
export type MotionToken = z.infer<typeof motionTokenSchema>;

// ---------------------------------------------------------------------------
// Breakpoint
// ---------------------------------------------------------------------------

export const breakpointTokenSchema = baseTokenSchema.extend({
  category: z.literal('breakpoint'),
  value: lengthValueSchema,
  /** Semantic role of the breakpoint — detected via media-query walk. */
  breakpointRole: z.enum(['mobile', 'tablet', 'desktop', 'wide', 'other']),
  /** Raw media query string, e.g. `(min-width: 768px)`. */
  mediaQuery: z.string(),
});
export type BreakpointToken = z.infer<typeof breakpointTokenSchema>;

// ---------------------------------------------------------------------------
// Z-Index
// ---------------------------------------------------------------------------

export const zIndexTokenSchema = baseTokenSchema.extend({
  category: z.literal('z-index'),
  value: z.number().int(),
  /** Detected stacking role, if any. */
  stackingRole: z
    .enum(['base', 'dropdown', 'sticky', 'fixed', 'modal-backdrop', 'modal', 'popover', 'toast'])
    .optional(),
});
export type ZIndexToken = z.infer<typeof zIndexTokenSchema>;

// ---------------------------------------------------------------------------
// Opacity
// ---------------------------------------------------------------------------

export const opacityTokenSchema = baseTokenSchema.extend({
  category: z.literal('opacity'),
  value: z.number().min(0).max(1),
});
export type OpacityToken = z.infer<typeof opacityTokenSchema>;

// ---------------------------------------------------------------------------
// Filter (blur / backdrop-filter / drop-shadow, etc.)
// ---------------------------------------------------------------------------

export const filterOperationSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('blur'), radius: lengthValueSchema }),
  z.object({ kind: z.literal('brightness'), amount: z.number().nonnegative() }),
  z.object({ kind: z.literal('contrast'), amount: z.number().nonnegative() }),
  z.object({ kind: z.literal('grayscale'), amount: z.number().min(0).max(1) }),
  z.object({ kind: z.literal('invert'), amount: z.number().min(0).max(1) }),
  z.object({ kind: z.literal('opacity'), amount: z.number().min(0).max(1) }),
  z.object({ kind: z.literal('saturate'), amount: z.number().nonnegative() }),
  z.object({ kind: z.literal('sepia'), amount: z.number().min(0).max(1) }),
  z.object({ kind: z.literal('hue-rotate'), deg: z.number() }),
  z.object({
    kind: z.literal('drop-shadow'),
    offsetX: lengthValueSchema,
    offsetY: lengthValueSchema,
    blur: lengthValueSchema,
    color: colorValueSchema,
  }),
]);

export const filterTokenSchema = baseTokenSchema.extend({
  category: z.literal('filter'),
  value: z.object({
    operations: z.array(filterOperationSchema).min(1),
    target: z.enum(['filter', 'backdrop-filter']),
  }),
});
export type FilterToken = z.infer<typeof filterTokenSchema>;

// ---------------------------------------------------------------------------
// Discriminated union of all tokens
// ---------------------------------------------------------------------------

export const tokenSchema = z.discriminatedUnion('category', [
  colorTokenSchema,
  typographyTokenSchema,
  spacingTokenSchema,
  radiusTokenSchema,
  shadowTokenSchema,
  borderTokenSchema,
  gradientTokenSchema,
  motionTokenSchema,
  breakpointTokenSchema,
  zIndexTokenSchema,
  opacityTokenSchema,
  filterTokenSchema,
]);
export type Token = z.infer<typeof tokenSchema>;

export const tokenCategorySchema = z.enum([
  'color',
  'typography',
  'spacing',
  'radius',
  'shadow',
  'border',
  'gradient',
  'motion',
  'breakpoint',
  'z-index',
  'opacity',
  'filter',
]);
export type TokenCategory = z.infer<typeof tokenCategorySchema>;
