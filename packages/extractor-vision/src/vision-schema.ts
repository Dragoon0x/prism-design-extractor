/**
 * Richer vision schema for standalone image extraction.
 *
 * The URL pipeline's vision schema only fills *DOM blind spots* (gradients,
 * shadows). For image extraction, vision is our ONLY source of truth — so
 * the schema asks for typography with pixel hints, spacing with pixel hints,
 * radii, and structured shadow layers. Fusion maps this directly into
 * canonical tokens.
 */
import { z } from 'zod';

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'hex must be #RRGGBB');

export const paletteEntrySchema = z.object({
  hex,
  role: z
    .enum([
      'primary',
      'secondary',
      'surface',
      'surface-subtle',
      'background',
      'foreground',
      'muted-foreground',
      'accent',
      'destructive',
      'success',
      'warning',
      'info',
      'neutral',
    ])
    .optional(),
  /** Approximate fraction of the image's visible area this color occupies. Used for usage weighting. */
  approximateArea: z.number().min(0).max(1).optional(),
  note: z.string().optional(),
});

export const typographyEntrySchema = z.object({
  role: z
    .enum(['display', 'heading-1', 'heading-2', 'heading-3', 'subtitle', 'body', 'caption', 'label', 'button', 'code', 'other'])
    .default('other'),
  familyHint: z.string(),
  weightHint: z.number().int().min(100).max(900).default(400),
  sizePxHint: z.number().positive(),
  lineHeightPxHint: z.number().positive().optional(),
  letterSpacingPxHint: z.number().optional(),
  uppercase: z.boolean().default(false),
  italic: z.boolean().default(false),
  sampleText: z.string().max(200).optional(),
  confidence: z.number().min(0).max(1).default(0.7),
});

export const spacingEntrySchema = z.object({
  pxHint: z.number().nonnegative(),
  role: z.enum(['tight', 'normal', 'loose', 'section', 'container-gutter']).optional(),
  confidence: z.number().min(0).max(1).default(0.6),
});

export const radiusEntrySchema = z.object({
  pxHint: z.number().nonnegative(),
  target: z.enum(['button', 'card', 'input', 'badge', 'pill', 'image', 'other']).optional(),
  confidence: z.number().min(0).max(1).default(0.6),
});

export const shadowLayerEntrySchema = z.object({
  offsetX: z.number(),
  offsetY: z.number(),
  blur: z.number().nonnegative(),
  spread: z.number().default(0),
  color: hex,
  alpha: z.number().min(0).max(1).default(1),
  inset: z.boolean().default(false),
});

export const shadowEntrySchema = z.object({
  description: z.string(),
  layers: z.array(shadowLayerEntrySchema).min(1).max(5),
  target: z.enum(['card', 'button', 'modal', 'header', 'other']).default('other'),
  confidence: z.number().min(0).max(1).default(0.6),
});

export const gradientEntrySchema = z.object({
  kind: z.enum(['linear', 'radial', 'conic']).default('linear'),
  angleDeg: z.number().optional(),
  stops: z
    .array(
      z.object({
        hex,
        position: z.number().min(0).max(1).optional(),
      }),
    )
    .min(2)
    .max(8),
  description: z.string().optional(),
  confidence: z.number().min(0).max(1).default(0.6),
});

export const componentEntrySchema = z.object({
  kind: z.enum([
    'button', 'card', 'input', 'textarea', 'select', 'checkbox', 'radio', 'switch',
    'badge', 'chip', 'nav', 'navbar', 'sidebar', 'tabs', 'tab', 'modal', 'dialog',
    'popover', 'tooltip', 'toast', 'banner', 'alert', 'avatar', 'breadcrumb',
    'pagination', 'progress', 'slider', 'dropdown', 'menu', 'list', 'list-item',
    'table', 'footer', 'header', 'hero', 'feature', 'pricing-card', 'testimonial',
    'icon', 'logo', 'unknown',
  ]),
  bbox: z.object({
    x: z.number().nonnegative(),
    y: z.number().nonnegative(),
    width: z.number().nonnegative(),
    height: z.number().nonnegative(),
  }),
  variantHint: z.string().optional(),
  /** Token roles this component references (color roles, typography roles). */
  tokenRoleHints: z.record(z.string(), z.string()).optional(),
  confidence: z.number().min(0).max(1).default(0.7),
});

export const imageVisionReportSchema = z.object({
  palette: z.array(paletteEntrySchema).min(1).max(24),
  typography: z.array(typographyEntrySchema).max(20).default([]),
  spacing: z.array(spacingEntrySchema).max(16).default([]),
  radii: z.array(radiusEntrySchema).max(10).default([]),
  shadows: z.array(shadowEntrySchema).max(12).default([]),
  gradients: z.array(gradientEntrySchema).max(16).default([]),
  components: z.array(componentEntrySchema).max(50).default([]),
  /** Natural-language summary — not rendered, but useful for debug logs. */
  notes: z.string().max(1000).optional(),
});
export type ImageVisionReport = z.infer<typeof imageVisionReportSchema>;
