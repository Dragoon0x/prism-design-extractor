/**
 * Extraction metadata — what was fed in, which models ran, how much it cost,
 * how long it took. Carried on every `CanonicalExtraction` for observability
 * and billing transparency (BYOK users see every dollar of their spend).
 */
import { z } from 'zod';
import { viewportSchema } from './evidence.js';

export const inputTypeSchema = z.enum(['url', 'image', 'pdf']);
export type InputType = z.infer<typeof inputTypeSchema>;

export const inputRefSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('url'),
    url: z.string().url(),
    /** SHA-256 of the canonicalized URL (used for idempotency). */
    urlHash: z.string(),
  }),
  z.object({
    type: z.literal('image'),
    s3Key: z.string(),
    /** SHA-256 of the image bytes. */
    inputHash: z.string(),
    format: z.enum(['png', 'jpg', 'webp', 'svg']),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    bytes: z.number().int().positive(),
  }),
  z.object({
    type: z.literal('pdf'),
    s3Key: z.string(),
    inputHash: z.string(),
    pages: z.number().int().positive(),
    bytes: z.number().int().positive(),
  }),
]);
export type InputRef = z.infer<typeof inputRefSchema>;

/** A single Claude model call accounted for in the cost tally. */
export const modelCallSchema = z.object({
  stage: z.string(),
  model: z.string(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cacheReadTokens: z.number().int().nonnegative().default(0),
  cacheCreationTokens: z.number().int().nonnegative().default(0),
  /** USD cost, best-effort from published pricing. */
  costUsd: z.number().nonnegative(),
  durationMs: z.number().int().nonnegative(),
});
export type ModelCall = z.infer<typeof modelCallSchema>;

export const costSchema = z.object({
  totalUsd: z.number().nonnegative(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cacheReadTokens: z.number().int().nonnegative(),
  cacheCreationTokens: z.number().int().nonnegative(),
  calls: z.array(modelCallSchema).default([]),
});
export type Cost = z.infer<typeof costSchema>;

export const metaSchema = z.object({
  /** Which viewports were captured (URL pipeline only). */
  viewports: z.array(viewportSchema).default([]),
  /** Which PDF pages were processed (PDF pipeline only). */
  pagesProcessed: z.array(z.number().int().positive()).default([]),
  modelsUsed: z.array(z.string()).default([]),
  cost: costSchema,
  extractedAt: z.string().datetime(),
  durationMs: z.number().int().nonnegative(),
  /** Version of the canonical schema this extraction was produced against. */
  schemaVersion: z.string(),
});
export type Meta = z.infer<typeof metaSchema>;

export const warningSchema = z.object({
  stage: z.string(),
  message: z.string(),
  severity: z.enum(['info', 'warn', 'error']).default('warn'),
});
export type Warning = z.infer<typeof warningSchema>;
