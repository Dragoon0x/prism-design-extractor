/**
 * POST /api/worker/pdf-reconcile — merge per-page fragments into a final canonical.
 *
 * QStash dedupes on `extractionId:reconcile` so exactly one reconcile runs per
 * extraction even though every page worker enqueues on completion.
 *
 * If called before all pages finish, we no-op and wait — QStash doesn't retry
 * this (the next page worker to finish will enqueue again and we'll re-check).
 */
import { NextResponse } from 'next/server';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { schema, type DbClient } from '@prism/db';
import { reconcilePdfFragments } from '@prism/extractor-pdf';
import { runIntelligence } from '@prism/intelligence';
import { SUPPORTED_FORMATS_V1 } from '@prism/outputs';
import { openKey } from '@/lib/key-envelope';
import {
  enqueueGenerateOutputs,
  publishDelta,
  publishStage,
  QStashUnauthorizedError,
  reconcilePdfJobSchema,
  verifyQStashRequest,
} from '@prism/queue';
import { canonicalExtractionSchema, SCHEMA_VERSION } from '@prism/shared';
import { db } from '@/lib/db';

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

  const parsed = reconcilePdfJobSchema.safeParse(JSON.parse(rawBody));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_job', detail: parsed.error.message },
      { status: 400 },
    );
  }
  const { extractionId, inputHash, keyEnvelope, modelOverrides } = parsed.data;

  let apiKey: string;
  try {
    apiKey = openKey(keyEnvelope);
  } catch (err) {
    return NextResponse.json(
      { error: 'invalid_envelope', detail: (err as Error).message },
      { status: 400 },
    );
  }

  // 1. Are all pages done? If any are still pending/running, wait.
  const rows = await (db as unknown as DbClient)
    .select()
    .from(schema.pdfPageResults)
    .where(eq(schema.pdfPageResults.extractionId, extractionId))
    .orderBy(asc(schema.pdfPageResults.pageNumber));

  if (rows.length === 0) {
    return NextResponse.json({ ok: false, reason: 'no_pages' }, { status: 200 });
  }
  const pending = rows.filter((r) => r.status === 'pending' || r.status === 'running');
  if (pending.length > 0) {
    return NextResponse.json(
      { ok: false, reason: 'not_ready', pending: pending.length },
      { status: 200 },
    );
  }

  // 2. Try to atomically claim the reconciler: only succeed if the extraction
  // is still in 'running'. Other duplicate reconcile invocations bail.
  const [locked] = await (db as unknown as DbClient)
    .update(schema.extractions)
    .set({ status: 'running' })
    .where(
      and(
        eq(schema.extractions.id, extractionId),
        inArray(schema.extractions.status, ['running', 'queued']),
      ),
    )
    .returning({ id: schema.extractions.id, createdAt: schema.extractions.createdAt });

  if (!locked) {
    return NextResponse.json({ ok: true, reason: 'already_reconciled' }, { status: 200 });
  }

  // 3. Determine pdf blob url + byte count from the extractions record.
  const [extraction] = await (db as unknown as DbClient)
    .select()
    .from(schema.extractions)
    .where(eq(schema.extractions.id, extractionId))
    .limit(1);
  if (!extraction) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  await publishStage(extractionId, 'fusion', 'started', {
    message: `merging ${rows.length} page fragments`,
  });

  // 4. Build fragments from stored canonicalFragment jsonb.
  const fragments: { pageNumber: number; fragment: ReturnType<typeof canonicalExtractionSchema.parse> }[] = [];
  for (const r of rows) {
    if (r.status !== 'succeeded' || !r.canonicalFragment) continue;
    const frag = canonicalExtractionSchema.safeParse(r.canonicalFragment);
    if (frag.success) fragments.push({ pageNumber: r.pageNumber, fragment: frag.data });
  }

  if (fragments.length === 0) {
    await publishStage(extractionId, 'failed', 'failed', { message: 'no page fragments succeeded' });
    await (db as unknown as DbClient)
      .update(schema.extractions)
      .set({ status: 'failed', error: 'no page fragments succeeded', completedAt: new Date() })
      .where(eq(schema.extractions.id, extractionId));
    return NextResponse.json({ ok: false, reason: 'all_pages_failed' }, { status: 200 });
  }

  // 5. Reconcile: apply cross-page weighting + cluster.
  const { canonical, stats } = reconcilePdfFragments({
    extractionId,
    inputHash,
    pdfBlobUrl: extraction.inputRef,
    pdfBytes: 0, // bytes not tracked; placeholder
    totalPages: rows.length,
    fragments,
    startedAt: extraction.createdAt,
  });

  await publishStage(extractionId, 'fusion', 'succeeded', {
    message: `${stats.clusteredTokens} tokens · ${stats.primaryTokens} primary · ${stats.rareTokens} rare`,
  });

  // 6. Intelligence: Opus semantic naming + deterministic audits.
  const intelligence = await runIntelligence({
    extraction: canonical,
    extractionId,
    apiKey,
    ...(modelOverrides?.reasoning ? { reasoningModel: modelOverrides.reasoning } : {}),
  });
  const enriched = intelligence.extraction;

  // 7. Stream the final token set so the results view populates.
  await publishStage(extractionId, 'clustering', 'succeeded', {
    message: `${stats.clusteredTokens} tokens after cross-page reconcile`,
  });
  for (const token of enriched.tokens) {
    await publishDelta(extractionId, { type: 'token', token, op: 'add' });
  }
  for (const component of enriched.components) {
    await publishDelta(extractionId, { type: 'component', component, op: 'add' });
  }
  for (const audit of enriched.audits) {
    await publishDelta(extractionId, { type: 'audit', audit });
  }

  // 8. Persist.
  await publishStage(extractionId, 'persistence', 'started');
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
    .where(eq(schema.extractions.id, extractionId));
  await publishStage(extractionId, 'persistence', 'succeeded');

  // 8. Trigger output generation.
  try {
    await enqueueGenerateOutputs({
      extractionId,
      formats: [...SUPPORTED_FORMATS_V1],
    });
  } catch (err) {
    console.warn(
      `[pdf-reconcile] enqueueGenerateOutputs failed for ${extractionId}:`,
      (err as Error).message,
    );
  }

  await publishDelta(extractionId, {
    type: 'final',
    extractionId,
    summary: {
      tokenCount: enriched.tokens.length,
      componentCount: enriched.components.length,
      auditCount: enriched.audits.length,
      costUsd: enriched.meta.cost.totalUsd,
      durationMs: enriched.meta.durationMs,
    },
  });

  return NextResponse.json({ ok: true, stats }, { status: 200 });
}
