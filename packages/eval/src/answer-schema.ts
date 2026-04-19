/**
 * Known-answer format for fixture images.
 *
 * Every fixture image `fixtures/images/<id>.png` has a matching
 * `fixtures/answers/<id>.json` matching this shape. The harness loads both,
 * runs the vision extractor against the image, and scores the output against
 * this answer.
 *
 * Fields are intentionally coarse — we're grading "did vision see the design
 * system roughly right?", not "did vision produce pixel-perfect pixel dumps."
 */
import { z } from 'zod';

export const paletteAnswerSchema = z.object({
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'hex must be #RRGGBB'),
  /** Human label, for the report. Not used for scoring. */
  label: z.string().optional(),
  /** Optional per-entry override of the overall ΔE threshold. Default 5. */
  deltaEThreshold: z.number().positive().optional(),
});
export type PaletteAnswer = z.infer<typeof paletteAnswerSchema>;

export const typographyAnswerSchema = z.object({
  role: z.string(),
  /** Any of these families is a match (case-insensitive). */
  familyCandidates: z.array(z.string()).min(1),
  sizePx: z.number().positive().optional(),
  sizeToleranceAbsPx: z.number().positive().default(2),
  weight: z.number().int().min(100).max(900).optional(),
  weightTolerance: z.number().int().default(100),
});
export type TypographyAnswer = z.infer<typeof typographyAnswerSchema>;

export const componentAnswerSchema = z.object({
  kind: z.string(),
  variantHint: z.string().optional(),
});
export type ComponentAnswer = z.infer<typeof componentAnswerSchema>;

export const answerFileSchema = z.object({
  id: z.string().min(1),
  description: z.string().optional(),
  /** Expected palette — every entry counts for palette precision/recall. */
  palette: z.array(paletteAnswerSchema).min(1).max(24),
  /** Expected typography roles + family candidates. */
  typography: z.array(typographyAnswerSchema).default([]),
  /** Expected pixel spacing values (best-effort; ±1px tolerance on match). */
  spacingPx: z.array(z.number().nonnegative()).default([]),
  /** Expected corner radii in px (±1px tolerance). */
  radiiPx: z.array(z.number().nonnegative()).default([]),
  /** Expected detected components (coarse — kind match only, variant optional). */
  components: z.array(componentAnswerSchema).default([]),
  hasGradient: z.boolean().default(false),
  hasShadow: z.boolean().default(false),
});
export type AnswerFile = z.infer<typeof answerFileSchema>;
