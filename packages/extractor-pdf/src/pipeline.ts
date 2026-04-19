/**
 * PDF pipeline entry — called from `/api/worker/extract` when `inputType === 'pdf'`.
 *
 * Does ONLY the fan-out prep:
 *   1. Fetch PDF bytes from Blob
 *   2. Render each page → PNG
 *   3. Upload each page PNG to Blob
 *   4. Insert a pending `pdf_page_results` row for each page
 *   5. Enqueue a per-page QStash job (each → `/api/worker/pdf-page`)
 *
 * The actual vision extraction happens in the page worker (Phase 6 `extractFromImage`
 * with `stream: false`). The reconcile worker merges results once all pages finish.
 *
 * This function returns fast; the extraction's overall status stays `running`
 * until the reconciler commits the final canonical.
 */
import { put } from '@vercel/blob';
import { schema, type DbClient } from '@prism/db';
import { enqueuePdfPages, publishStage, type PdfPageJob } from '@prism/queue';
import { renderPdfPages } from './render.js';

export interface PdfPipelineInput {
  extractionId: string;
  pdfBytes: Buffer;
  keyEnvelope: string;
  blobToken: string;
  db: DbClient;
  maxPages?: number;
  visionModel?: string;
}

export interface PdfPipelineResult {
  totalPages: number;
  rendered: number;
  enqueued: number;
}

export async function dispatchPdfExtraction(
  input: PdfPipelineInput,
): Promise<PdfPipelineResult> {
  await publishStage(input.extractionId, 'pdf-splitting', 'started');

  // 1. Render all pages + upload each to Blob.
  const uploaded: {
    pageNumber: number;
    url: string;
    widthPx: number;
    heightPx: number;
  }[] = [];
  let rendered = 0;
  let totalPages = 0;

  for await (const page of renderPdfPages(input.pdfBytes, {
    scale: 2,
    maxPages: input.maxPages ?? 30,
  })) {
    rendered++;
    totalPages = Math.max(totalPages, page.pageNumber);
    const blob = await put(
      `extractions/${input.extractionId}/pages/${String(page.pageNumber).padStart(3, '0')}.png`,
      page.pngBytes,
      {
        access: 'public',
        contentType: 'image/png',
        token: input.blobToken,
      },
    );
    uploaded.push({
      pageNumber: page.pageNumber,
      url: blob.url,
      widthPx: page.widthPx,
      heightPx: page.heightPx,
    });
    await publishStage(input.extractionId, 'page-rendering', 'progress', {
      progress: uploaded.length > 0 ? uploaded.length / (uploaded.length + 1) : 0,
      message: `rendered page ${page.pageNumber}`,
    });
  }

  if (uploaded.length === 0) {
    await publishStage(input.extractionId, 'pdf-splitting', 'failed', {
      message: 'PDF contained no renderable pages',
    });
    throw new Error('PDF contained no renderable pages');
  }

  await publishStage(input.extractionId, 'pdf-splitting', 'succeeded', {
    message: `${uploaded.length} pages`,
  });

  // 2. Seed pdf_page_results rows (idempotent on (extractionId, pageNumber)).
  for (const u of uploaded) {
    await input.db
      .insert(schema.pdfPageResults)
      .values({
        extractionId: input.extractionId,
        pageNumber: u.pageNumber,
        totalPages: uploaded.length,
        status: 'pending',
        pageImageBlobUrl: u.url,
      })
      .onConflictDoNothing({
        target: [schema.pdfPageResults.extractionId, schema.pdfPageResults.pageNumber],
      });
  }

  // 3. Fan out per-page jobs.
  const jobs: PdfPageJob[] = uploaded.map((u) => ({
    extractionId: input.extractionId,
    pageNumber: u.pageNumber,
    totalPages: uploaded.length,
    pageImageBlobUrl: u.url,
    keyEnvelope: input.keyEnvelope,
    ...(input.visionModel ? { modelOverrides: { vision: input.visionModel } } : {}),
  }));
  const messageIds = await enqueuePdfPages(jobs);

  await publishStage(input.extractionId, 'page-rendering', 'succeeded', {
    message: `queued ${messageIds.length}/${uploaded.length} page jobs`,
  });

  return { totalPages: uploaded.length, rendered, enqueued: messageIds.length };
}
