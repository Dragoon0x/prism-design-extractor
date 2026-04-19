/**
 * POST /api/worker/pdf-page — per-page vision extraction for a PDF.
 *
 * QStash delivers one of these per page, fanned out from the main extract
 * worker. This route:
 *   1. Verifies the QStash signature.
 *   2. Fetches the page image from Blob.
 *   3. Runs `extractFromImage` with `stream: false` (page-level deltas would
 *      overwhelm the UI at scale).
 *   4. Persists the per-page canonical fragment to `pdf_page_results`.
 *   5. Publishes a `page-rendering` progress delta.
 *   6. Enqueues a reconcile job with `deduplicationId` keyed by extractionId
 *      — QStash guarantees only one reconciler runs even if multiple pages
 *      finish simultaneously.
 */
import { NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { schema, type DbClient } from '@prism/db';
import { extractFromImage } from '@prism/extractor-vision';
import {
  enqueueReconcilePdf,
  pdfPageJobSchema,
  publishStage,
  QStashUnauthorizedError,
  verifyQStashRequest,
} from '@prism/queue';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { openKey } from '@/lib/key-envelope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

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

  const parsed = pdfPageJobSchema.safeParse(JSON.parse(rawBody));
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
    return NextResponse.json({ error: 'invalid_envelope', detail: (err as Error).message }, { status: 400 });
  }

  // Mark running (best-effort; on retry this is idempotent).
  await (db as unknown as DbClient)
    .update(schema.pdfPageResults)
    .set({ status: 'running' })
    .where(
      and(
        eq(schema.pdfPageResults.extractionId, job.extractionId),
        eq(schema.pdfPageResults.pageNumber, job.pageNumber),
      ),
    );

  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), env.EXTRACTION_PAGE_TIMEOUT_MS);

  try {
    const res = await fetch(job.pageImageBlobUrl);
    if (!res.ok) throw new Error(`failed to fetch page image (HTTP ${res.status})`);
    const arr = await res.arrayBuffer();
    const bytes = Buffer.from(arr);

    const { canonical } = await extractFromImage({
      extractionId: job.extractionId,
      imageBytes: bytes,
      descriptor: `page-${job.pageNumber}`,
      apiKey,
      pageNumber: job.pageNumber,
      stream: false,
      ...(job.modelOverrides?.vision ? { visionModel: job.modelOverrides.vision } : {}),
      signal: abort.signal,
    });
    clearTimeout(timeout);

    await (db as unknown as DbClient)
      .update(schema.pdfPageResults)
      .set({
        status: 'succeeded',
        canonicalFragment: canonical,
        costUsd: canonical.meta.cost.totalUsd,
        inputTokens: canonical.meta.cost.inputTokens,
        outputTokens: canonical.meta.cost.outputTokens,
        completedAt: new Date(),
      })
      .where(
        and(
          eq(schema.pdfPageResults.extractionId, job.extractionId),
          eq(schema.pdfPageResults.pageNumber, job.pageNumber),
        ),
      );

    // Progress delta keyed to the parent extraction.
    const progressRows = (await (db as unknown as DbClient).execute(
      sql`
        SELECT
          COUNT(*) FILTER (WHERE status IN ('succeeded', 'failed'))::int AS done,
          COUNT(*)::int AS total
        FROM ${schema.pdfPageResults}
        WHERE extraction_id = ${job.extractionId}
      `,
    )) as unknown as { done: number; total: number }[];
    const { done = 0, total = 0 } = progressRows[0] ?? {};
    await publishStage(job.extractionId, 'page-rendering', 'progress', {
      progress: total === 0 ? 0 : done / total,
      message: `page ${job.pageNumber}/${total} complete (${done}/${total} done)`,
    });

    // Enqueue reconcile (dedup guarantees only one runs even if many pages
    // finish simultaneously).
    await enqueueReconcilePdf({
      extractionId: job.extractionId,
      inputHash: await loadInputHash(job.extractionId),
      keyEnvelope: job.keyEnvelope,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    clearTimeout(timeout);
    const message = (err as Error).message;
    await (db as unknown as DbClient)
      .update(schema.pdfPageResults)
      .set({ status: 'failed', error: message, completedAt: new Date() })
      .where(
        and(
          eq(schema.pdfPageResults.extractionId, job.extractionId),
          eq(schema.pdfPageResults.pageNumber, job.pageNumber),
        ),
      );
    // Still enqueue reconcile — it will decide whether we can finalize with a partial.
    try {
      await enqueueReconcilePdf({
        extractionId: job.extractionId,
        inputHash: await loadInputHash(job.extractionId),
        keyEnvelope: job.keyEnvelope,
      });
    } catch {
      // best-effort
    }
    return NextResponse.json({ ok: false, error: message }, { status: 200 });
  }
}

async function loadInputHash(extractionId: string): Promise<string> {
  const [row] = await (db as unknown as DbClient)
    .select({ inputHash: schema.extractions.inputHash })
    .from(schema.extractions)
    .where(eq(schema.extractions.id, extractionId))
    .limit(1);
  return row?.inputHash ?? '';
}
