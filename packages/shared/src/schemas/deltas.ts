/**
 * Streaming extraction deltas — what the worker emits over Redis pub/sub,
 * and what the Next.js SSE endpoint fans out to clients.
 *
 * The UI renders partial results progressively: palette swatches appear first,
 * typography second, components last. Each delta is a small, typed event.
 */
import { z } from 'zod';
import { auditSchema } from './audits.js';
import { componentSchema } from './components.js';
import { tokenSchema } from './tokens.js';
import { warningSchema, modelCallSchema } from './meta.js';

/** High-level stage identifiers emitted during the pipeline. */
export const extractionStageSchema = z.enum([
  'queued',
  'validating',
  'browser-launching',
  'page-loading',
  'viewport-capture',
  'computed-styles',
  'state-sampling',
  'axe-audit',
  'pdf-splitting',
  'page-rendering',
  'image-preprocessing',
  'vision-call',
  'ocr',
  'fusion',
  'clustering',
  'confidence-scoring',
  'intelligence-naming',
  'intelligence-audits',
  'output-generation',
  'persistence',
  'done',
  'failed',
]);
export type ExtractionStage = z.infer<typeof extractionStageSchema>;

export const stageDeltaSchema = z.object({
  type: z.literal('stage'),
  stage: extractionStageSchema,
  status: z.enum(['started', 'progress', 'succeeded', 'skipped', 'failed']),
  /** 0..1 progress fraction within the stage, if computable. */
  progress: z.number().min(0).max(1).optional(),
  message: z.string().optional(),
  timestamp: z.string().datetime(),
});
export type StageDelta = z.infer<typeof stageDeltaSchema>;

export const tokenDeltaSchema = z.object({
  type: z.literal('token'),
  token: tokenSchema,
  op: z.enum(['add', 'update']),
});
export type TokenDelta = z.infer<typeof tokenDeltaSchema>;

export const componentDeltaSchema = z.object({
  type: z.literal('component'),
  component: componentSchema,
  op: z.enum(['add', 'update']),
});
export type ComponentDelta = z.infer<typeof componentDeltaSchema>;

export const auditDeltaSchema = z.object({
  type: z.literal('audit'),
  audit: auditSchema,
});
export type AuditDelta = z.infer<typeof auditDeltaSchema>;

export const warningDeltaSchema = z.object({
  type: z.literal('warning'),
  warning: warningSchema,
});
export type WarningDelta = z.infer<typeof warningDeltaSchema>;

export const costDeltaSchema = z.object({
  type: z.literal('cost'),
  call: modelCallSchema,
  runningTotalUsd: z.number().nonnegative(),
});
export type CostDelta = z.infer<typeof costDeltaSchema>;

export const finalDeltaSchema = z.object({
  type: z.literal('final'),
  extractionId: z.string(),
  /** Small summary; full CanonicalExtraction is fetched separately over HTTP. */
  summary: z.object({
    tokenCount: z.number().int().nonnegative(),
    componentCount: z.number().int().nonnegative(),
    auditCount: z.number().int().nonnegative(),
    costUsd: z.number().nonnegative(),
    durationMs: z.number().int().nonnegative(),
  }),
});
export type FinalDelta = z.infer<typeof finalDeltaSchema>;

export const extractionDeltaSchema = z.discriminatedUnion('type', [
  stageDeltaSchema,
  tokenDeltaSchema,
  componentDeltaSchema,
  auditDeltaSchema,
  warningDeltaSchema,
  costDeltaSchema,
  finalDeltaSchema,
]);
export type ExtractionDelta = z.infer<typeof extractionDeltaSchema>;
