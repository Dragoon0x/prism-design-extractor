/**
 * POST /api/worker/extract — QStash target.
 *
 * Verifies the QStash signature, decrypts the key envelope, dispatches to the
 * appropriate extractor pipeline (URL → `@prism/extractor-url`, image →
 * `@prism/extractor-vision`), and persists the final canonical tree.
 *
 * Runs under Vercel's `maxDuration: 300` config (see vercel.json).
 */
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { put } from '@vercel/blob';
import { schema, type DbClient } from '@prism/db';
import { extractFromUrl } from '@prism/extractor-url';
import { extractFromImage } from '@prism/extractor-vision';
import { dispatchPdfExtraction } from '@prism/extractor-pdf';
import { runIntelligence } from '@prism/intelligence';
import {
  enqueueGenerateOutputs,
  extractJobSchema,
  publishDelta,
  publishStage,
  QStashUnauthorizedError,
  verifyQStashRequest,
  type ExtractJob,
} from '@prism/queue';
import { SUPPORTED_FORMATS_V1 } from '@prism/outputs';
import {
  SCHEMA_VERSION,
  canonicalExtractionSchema,
  type CanonicalExtraction,
  type ViewportName,
} from '@prism/shared';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { openKey } from '@/lib/key-envelope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request): Promise<NextResponse> {
  let rawBody: string;
  try {
    rawBody = await verifyQStashRequest(request);
  } catch (err) {
    if (err instanceof QStashUnauthorizedError) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    throw err;
  }

  const parsed = extractJobSchema.safeParse(JSON.parse(rawBody));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_job', detail: parsed.error.message },
      { status: 400 },
    );
  }
  const job = parsed.data;

  let apiKey: string;
  try {
    apiKey = openKey(job.keyEnvelope);
  } catch (err) {
    return NextResponse.json(
      { error: 'invalid_envelope', detail: (err as Error).message },
      { status: 400 },
    );
  }

  await (db as unknown as DbClient)
    .update(schema.extractions)
    .set({ status: 'running' })
    .where(eq(schema.extractions.id, job.extractionId));

  const abort = new AbortController();
  const timeoutMs =
    job.inputType === 'url' ? env.EXTRACTION_URL_TIMEOUT_MS : env.EXTRACTION_IMAGE_TIMEOUT_MS;
  const timeout = setTimeout(() => abort.abort(), timeoutMs);

  try {
    let canonical: CanonicalExtraction;
    let extraScreenshots: Partial<Record<ViewportName, Buffer>> = {};

    if (job.inputType === 'url') {
      const result = await extractFromUrl({
        extractionId: job.extractionId,
        url: job.inputRef,
        apiKey,
        ...(job.modelOverrides?.vision ? { visionModel: job.modelOverrides.vision } : {}),
        includeAxe: job.options.includeAxe,
        signal: abort.signal,
      });
      canonical = result.canonical;
      extraScreenshots = result.screenshotsByViewport;
    } else if (job.inputType === 'image') {
      const bytes = await fetchBlobBytes(job.inputRef);
      const result = await extractFromImage({
        extractionId: job.extractionId,
        imageBytes: bytes,
        descriptor: job.inputRef,
        apiKey,
        ...(job.modelOverrides?.vision ? { visionModel: job.modelOverrides.vision } : {}),
        signal: abort.signal,
      });
      canonical = result.canonical;
    } else if (job.inputType === 'pdf') {
      // PDF: render → fan out per-page jobs → done. The reconcile worker
      // finalizes the canonical after every page finishes. We return here;
      // the rest of this function only runs for URL/image paths.
      const pdfBytes = await fetchBlobBytes(job.inputRef);
      const result = await dispatchPdfExtraction({
        extractionId: job.extractionId,
        pdfBytes,
        keyEnvelope: job.keyEnvelope,
        blobToken: env.BLOB_READ_WRITE_TOKEN,
        db: db as unknown as DbClient,
        ...(job.options.maxPages ? { maxPages: job.options.maxPages } : {}),
        ...(job.modelOverrides?.vision ? { visionModel: job.modelOverrides.vision } : {}),
      });
      clearTimeout(timeout);
      await publishStage(job.extractionId, 'page-rendering', 'succeeded', {
        message: `fan-out: ${result.enqueued} page jobs`,
      });
      return NextResponse.json({ ok: true, enqueued: result.enqueued }, { status: 200 });
    } else {
      throw new Error(`unknown input type: ${String((job as ExtractJob).inputType)}`);
    }
    clearTimeout(timeout);

    // Ensure the extractor output passes Zod and stamp the input hash from the job.
    const validated = canonicalExtractionSchema.parse({
      ...canonical,
      input:
        canonical.input.type === 'url'
          ? { ...canonical.input, urlHash: job.inputHash }
          : { ...canonical.input, inputHash: job.inputHash },
    });

    // Intelligence: Opus semantic naming + deterministic audits.
    const intelligence = await runIntelligence({
      extraction: validated,
      extractionId: job.extractionId,
      apiKey,
      enableNaming: !job.options.disableReasoning,
      ...(job.modelOverrides?.reasoning ? { reasoningModel: job.modelOverrides.reasoning } : {}),
      signal: abort.signal,
    });
    const enriched = intelligence.extraction;

    // Persist URL-pipeline screenshots to Blob (image-pipeline skips this).
    await publishStage(job.extractionId, 'persistence', 'started');
    for (const [viewport, buf] of Object.entries(extraScreenshots) as [
      ViewportName,
      Buffer | undefined,
    ][]) {
      if (!buf) continue;
      await put(
        `extractions/${job.extractionId}/viewports/${viewport}.png`,
        buf,
        {
          access: 'public',
          contentType: 'image/png',
          token: env.BLOB_READ_WRITE_TOKEN,
        },
      );
    }

    await (db as unknown as DbClient)
      .update(schema.extractions)
      .set({
        status: 'succeeded',
        canonicalTree: enriched,
        modelsUsed: enriched.meta.modelsUsed,
        inputTokens: enriched.meta.cost.inputTokens,
        outputTokens: enriched.meta.cost.outputTokens,
        cacheReadTokens: enriched.meta.cost.cacheReadTokens,
        cacheCreationTokens: enriched.meta.cost.cacheCreationTokens,
        costUsd: enriched.meta.cost.totalUsd,
        durationMs: enriched.meta.durationMs,
        schemaVersion: SCHEMA_VERSION,
        completedAt: new Date(),
      })
      .where(eq(schema.extractions.id, job.extractionId));

    await publishStage(job.extractionId, 'persistence', 'succeeded');

    // Kick off deterministic output generation (DESIGN.md, Tailwind, CSS, …).
    try {
      await enqueueGenerateOutputs({
        extractionId: job.extractionId,
        formats: [...SUPPORTED_FORMATS_V1],
      });
      await publishStage(job.extractionId, 'output-generation', 'started', {
        message: `enqueued ${SUPPORTED_FORMATS_V1.length} formats`,
      });
    } catch (err) {
      console.warn(
        `[extract] enqueueGenerateOutputs failed for ${job.extractionId}:`,
        (err as Error).message,
      );
    }

    await publishDelta(job.extractionId, {
      type: 'final',
      extractionId: job.extractionId,
      summary: {
        tokenCount: enriched.tokens.length,
        componentCount: enriched.components.length,
        auditCount: enriched.audits.length,
        costUsd: enriched.meta.cost.totalUsd,
        durationMs: enriched.meta.durationMs,
      },
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    clearTimeout(timeout);
    const message = (err as Error).message;
    await (db as unknown as DbClient)
      .update(schema.extractions)
      .set({ status: 'failed', error: message, completedAt: new Date() })
      .where(eq(schema.extractions.id, job.extractionId));
    await publishStage(job.extractionId, 'failed', 'failed', { message });
    return NextResponse.json({ ok: false, error: message }, { status: 200 });
  }
}

/** Fetch the raw bytes for an uploaded image from Vercel Blob by URL. */
async function fetchBlobBytes(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch upload (HTTP ${res.status})`);
  const arr = await res.arrayBuffer();
  const bytes = Buffer.from(arr);
  if (bytes.byteLength === 0) throw new Error('Empty upload');
  if (bytes.byteLength > env.MAX_IMAGE_BYTES) {
    throw new Error(`Upload exceeds limit (${bytes.byteLength} > ${env.MAX_IMAGE_BYTES} bytes)`);
  }
  return bytes;
}
