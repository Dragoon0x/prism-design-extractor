/**
 * QStash producers. Next.js API routes call these to enqueue background work.
 *
 * QStash delivers a signed HTTP POST to the target URL. Workers verify the
 * signature via `@upstash/qstash/nextjs` receiver; see `verifier.ts`.
 */
import { Client } from '@upstash/qstash';
import {
  extractJobSchema,
  generateOutputsJobSchema,
  pdfPageJobSchema,
  reconcilePdfJobSchema,
  WORKER_PATHS,
  type ExtractJob,
  type GenerateOutputsJob,
  type PdfPageJob,
  type ReconcilePdfJob,
} from './jobs.js';

let cachedClient: Client | undefined;

function getClient(): Client {
  if (!cachedClient) {
    const token = process.env.QSTASH_TOKEN;
    if (!token) throw new Error('QSTASH_TOKEN is required');
    cachedClient = new Client({ token });
  }
  return cachedClient;
}

function deliveryUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (!base) throw new Error('NEXT_PUBLIC_APP_URL is required to build QStash delivery URLs');
  return `${base}${path}`;
}

/** Enqueue the top-level extraction job. Idempotent on `extractionId`. */
export async function enqueueExtract(job: ExtractJob): Promise<string> {
  const parsed = extractJobSchema.parse(job);
  const client = getClient();
  const res = await client.publishJSON({
    url: deliveryUrl(WORKER_PATHS.extract),
    body: parsed,
    deduplicationId: parsed.extractionId,
    retries: 3,
    notifyOnFailure: true,
  });
  return res.messageId;
}

/**
 * Fan-out: enqueue one child job per PDF page. Each child is its own function
 * invocation — this is how we stay under the Vercel function time limit for
 * multi-page documents.
 */
export async function enqueuePdfPages(jobs: PdfPageJob[]): Promise<string[]> {
  const client = getClient();
  const parsed = jobs.map((j) => pdfPageJobSchema.parse(j));
  const messages = await client.batchJSON(
    parsed.map((p) => ({
      url: deliveryUrl(WORKER_PATHS.pdfPage),
      body: p,
      deduplicationId: `${p.extractionId}:page:${p.pageNumber}`,
      retries: 2,
    })),
  );
  return messages.map((m) => m.messageId);
}

/** Enqueue a deterministic output-generation job after extraction completes. */
export async function enqueueGenerateOutputs(job: GenerateOutputsJob): Promise<string> {
  const parsed = generateOutputsJobSchema.parse(job);
  const client = getClient();
  const res = await client.publishJSON({
    url: deliveryUrl(WORKER_PATHS.generateOutputs),
    body: parsed,
    deduplicationId: `${parsed.extractionId}:outputs`,
    retries: 3,
  });
  return res.messageId;
}

/**
 * Enqueue the reconcile step for a PDF extraction. Safe to call from every
 * page worker — QStash's `deduplicationId` guarantees only one reconcile fires.
 */
export async function enqueueReconcilePdf(job: ReconcilePdfJob): Promise<string> {
  const parsed = reconcilePdfJobSchema.parse(job);
  const client = getClient();
  const res = await client.publishJSON({
    url: deliveryUrl(WORKER_PATHS.pdfReconcile),
    body: parsed,
    deduplicationId: `${parsed.extractionId}:reconcile`,
    retries: 3,
  });
  return res.messageId;
}
