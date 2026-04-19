/**
 * Evidence: the trust surface. Every token in Prism carries an `evidence[]`
 * array of these items so a user (or auditor) can click through to exactly
 * where a value was observed — selector, viewport, PDF page, screenshot crop,
 * computed-style snapshot.
 *
 * Without evidence, extraction is a black box. With it, every claim is falsifiable.
 */
import { z } from 'zod';
import { bboxSchema } from './primitives.js';

export const viewportNameSchema = z.enum(['mobile', 'tablet', 'desktop', 'wide']);
export type ViewportName = z.infer<typeof viewportNameSchema>;

export const viewportSchema = z.object({
  name: viewportNameSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  deviceScaleFactor: z.number().positive().default(1),
});
export type Viewport = z.infer<typeof viewportSchema>;

/**
 * Where a token was observed. All fields are optional except `source` so a
 * single schema covers URL, image, and PDF origins.
 */
export const evidenceItemSchema = z.object({
  /** What input surface produced this evidence. */
  source: z.enum(['dom', 'vision', 'computed-style', 'stylesheet', 'pdf-text', 'ocr']),
  /** Stable CSS selector (from `@medv/finder`-style library), when DOM-derived. */
  selector: z.string().optional(),
  /** Viewport in which this was captured. */
  viewport: viewportNameSchema.optional(),
  /** PDF page number, 1-indexed. */
  pageNumber: z.number().int().positive().optional(),
  /** S3 key for the cropped screenshot showing this evidence. */
  screenshotCropKey: z.string().optional(),
  /** Optional bbox within the source image. */
  bbox: bboxSchema.optional(),
  /** Computed-style snapshot fragment (only the relevant properties). */
  computedStyle: z.record(z.string(), z.string()).optional(),
  /** Raw source text (e.g. the CSS declaration, the PDF run). */
  rawText: z.string().optional(),
  /** State the element was in (":hover", ":focus-visible", ":active", ":disabled"). */
  elementState: z
    .enum(['default', 'hover', 'focus-visible', 'active', 'disabled'])
    .optional(),
});
export type EvidenceItem = z.infer<typeof evidenceItemSchema>;
