/**
 * Primitive value shapes used throughout the canonical token tree.
 * These are the atomic building blocks: a color is a ColorValue, a length
 * is a LengthValue, etc. Every token's `value` field is one of these.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Hex / RGB / HSL / OKLCH unification
// ---------------------------------------------------------------------------

export const rgbSchema = z.object({
  r: z.number().int().min(0).max(255),
  g: z.number().int().min(0).max(255),
  b: z.number().int().min(0).max(255),
});

export const hslSchema = z.object({
  h: z.number().min(0).max(360),
  s: z.number().min(0).max(100),
  l: z.number().min(0).max(100),
});

export const oklchSchema = z.object({
  l: z.number().min(0).max(1),
  c: z.number().nonnegative(),
  h: z.number().min(0).max(360),
});

export const colorValueSchema = z.object({
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'hex must be #RRGGBB'),
  rgb: rgbSchema,
  hsl: hslSchema,
  oklch: oklchSchema,
  alpha: z.number().min(0).max(1),
  // Human-readable name (e.g. "slate-900", "primary-500") — may be empty
  // until the intelligence layer names it.
  colorName: z.string().optional(),
});
export type ColorValue = z.infer<typeof colorValueSchema>;

// ---------------------------------------------------------------------------
// Length (a numeric + unit)
// ---------------------------------------------------------------------------

export const lengthUnitSchema = z.enum([
  'px',
  'rem',
  'em',
  '%',
  'vh',
  'vw',
  'ch',
  'ex',
  'pt',
  'dvh',
  'dvw',
  'svh',
  'svw',
  'lvh',
  'lvw',
  'fr',
  'deg',
  'rad',
  'turn',
]);
export type LengthUnit = z.infer<typeof lengthUnitSchema>;

export const lengthValueSchema = z.object({
  value: z.number(),
  unit: lengthUnitSchema,
  /** Normalized value in px (computed where possible). */
  px: z.number().optional(),
});
export type LengthValue = z.infer<typeof lengthValueSchema>;

// ---------------------------------------------------------------------------
// Duration (for motion tokens)
// ---------------------------------------------------------------------------

export const durationValueSchema = z.object({
  ms: z.number().nonnegative(),
});
export type DurationValue = z.infer<typeof durationValueSchema>;

// ---------------------------------------------------------------------------
// Easing (cubic-bezier or named)
// ---------------------------------------------------------------------------

export const easingValueSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('named'),
    name: z.enum([
      'linear',
      'ease',
      'ease-in',
      'ease-out',
      'ease-in-out',
      'step-start',
      'step-end',
    ]),
  }),
  z.object({
    kind: z.literal('cubic-bezier'),
    p1x: z.number(),
    p1y: z.number(),
    p2x: z.number(),
    p2y: z.number(),
  }),
  z.object({
    kind: z.literal('steps'),
    count: z.number().int().positive(),
    position: z.enum(['start', 'end', 'jump-start', 'jump-end', 'jump-none', 'jump-both']),
  }),
]);
export type EasingValue = z.infer<typeof easingValueSchema>;

// ---------------------------------------------------------------------------
// Bounding box (used in vision evidence and component detection)
// ---------------------------------------------------------------------------

export const bboxSchema = z.object({
  x: z.number().nonnegative(),
  y: z.number().nonnegative(),
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
});
export type BBox = z.infer<typeof bboxSchema>;
