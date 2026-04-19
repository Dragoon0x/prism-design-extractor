/**
 * Job payload schemas. A Vercel function receiving a QStash delivery parses
 * the request body against one of these before touching downstream state.
 */
import { z } from 'zod';

/** The top-level extraction job delivered to `/api/worker/extract`. */
export const extractJobSchema = z.object({
  extractionId: z.string().min(1),
  projectId: z.string().min(1),
  inputType: z.enum(['url', 'image', 'pdf']),
  /** URL string, or Vercel Blob URL for image / PDF uploads. */
  inputRef: z.string().min(1),
  inputHash: z.string().min(1),
  /** Anon users send the Anthropic key per-request and it's forwarded here via an
   *  encrypted-at-rest envelope (not the raw key — set server-side at enqueue time). */
  keyEnvelope: z.string().min(1),
  modelOverrides: z
    .object({
      vision: z.string().optional(),
      reasoning: z.string().optional(),
      fast: z.string().optional(),
    })
    .optional(),
  options: z
    .object({
      disableReasoning: z.boolean().default(false),
      maxPages: z.number().int().positive().optional(),
      includeAssets: z.boolean().default(true),
      includeAxe: z.boolean().default(true),
    })
    .default({ disableReasoning: false, includeAssets: true, includeAxe: true }),
  enqueuedAt: z.string().datetime(),
});
export type ExtractJob = z.infer<typeof extractJobSchema>;

/** Per-page PDF job delivered to `/api/worker/pdf-page`. */
export const pdfPageJobSchema = z.object({
  extractionId: z.string().min(1),
  pageNumber: z.number().int().positive(),
  totalPages: z.number().int().positive(),
  pageImageBlobUrl: z.string().url(),
  keyEnvelope: z.string().min(1),
  modelOverrides: z
    .object({
      vision: z.string().optional(),
    })
    .optional(),
});
export type PdfPageJob = z.infer<typeof pdfPageJobSchema>;

/** Reconcile job — enqueued (with dedupe) by the last page worker to complete. */
export const reconcilePdfJobSchema = z.object({
  extractionId: z.string().min(1),
  inputHash: z.string().min(1),
  /** Forwarded from the parent extract job so the reconciler can run Opus naming. */
  keyEnvelope: z.string().min(1),
  modelOverrides: z
    .object({
      reasoning: z.string().optional(),
    })
    .optional(),
});
export type ReconcilePdfJob = z.infer<typeof reconcilePdfJobSchema>;

/** Output-generation job delivered to `/api/worker/generate-outputs`. */
export const generateOutputsJobSchema = z.object({
  extractionId: z.string().min(1),
  formats: z.array(z.string()).min(1),
});
export type GenerateOutputsJob = z.infer<typeof generateOutputsJobSchema>;

/** Stable route paths for QStash destinations. */
export const WORKER_PATHS = {
  extract: '/api/worker/extract',
  pdfPage: '/api/worker/pdf-page',
  pdfReconcile: '/api/worker/pdf-reconcile',
  generateOutputs: '/api/worker/generate-outputs',
} as const;

/** Redis pub/sub channel for streaming deltas to the SSE plane. */
export function deltaChannel(extractionId: string): string {
  return `prism:delta:${extractionId}`;
}
