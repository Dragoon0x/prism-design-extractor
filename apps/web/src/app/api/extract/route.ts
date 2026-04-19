/**
 * POST /api/extract — ingestion endpoint.
 *
 * Body: `{ input: string; inputType?: 'url' | 'image-key' | 'pdf-key' }`
 * Header: `X-Anthropic-Key: sk-ant-...` (BYOK, forwarded from localStorage)
 *
 * Creates an extraction record, seals the BYOK key into an envelope, and enqueues
 * a QStash job. Returns `{ extractionId }` immediately so the client can open
 * the SSE stream.
 */
import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { schema, type DbClient } from '@prism/db';
import { enqueueExtract } from '@prism/queue';
import { SCHEMA_VERSION } from '@prism/shared';
import { db } from '@/lib/db';
import { anonLimiter, clientIp } from '@/lib/rate-limit';
import { sealKey } from '@/lib/key-envelope';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  input: z.string().min(1).max(2048),
  inputType: z.enum(['url', 'image', 'pdf']).default('url'),
  /** Vercel Blob key for uploaded images / PDFs. Required when inputType is image|pdf. */
  inputRef: z.string().optional(),
});

export async function POST(request: Request): Promise<NextResponse> {
  const ip = clientIp(request);
  const rl = await anonLimiter.limit(ip);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'rate_limited', retryAfter: rl.reset },
      { status: 429, headers: { 'Retry-After': `${Math.ceil((rl.reset - Date.now()) / 1000)}` } },
    );
  }

  const apiKey = request.headers.get('x-anthropic-key');
  if (!apiKey || !apiKey.startsWith('sk-ant-')) {
    return NextResponse.json(
      { error: 'missing_api_key', message: 'Provide your Anthropic API key via X-Anthropic-Key header.' },
      { status: 401 },
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    const raw = await request.json();
    body = bodySchema.parse(raw);
  } catch (err) {
    return NextResponse.json(
      { error: 'invalid_body', detail: (err as Error).message },
      { status: 400 },
    );
  }

  const inputRef = body.inputType === 'url' ? body.input : (body.inputRef ?? body.input);
  const inputHash = createHash('sha256').update(`${body.inputType}:${inputRef}`).digest('hex');

  // Ensure a project exists for this source. Anon extractions get their own project per run
  // (a later phase will let signed-in users group extractions into named projects).
  const projectId = randomUUID();
  const extractionId = randomUUID();
  await (db as unknown as DbClient).insert(schema.projects).values({
    id: projectId,
    slug: `p_${projectId.slice(0, 8)}`,
    visibility: 'unlisted',
    sourceUrl: body.inputType === 'url' ? body.input : null,
  });

  await (db as unknown as DbClient).insert(schema.extractions).values({
    id: extractionId,
    projectId,
    inputType: body.inputType,
    inputRef,
    inputHash,
    status: 'queued',
    schemaVersion: SCHEMA_VERSION,
  });

  const keyEnvelope = sealKey(apiKey);

  try {
    await enqueueExtract({
      extractionId,
      projectId,
      inputType: body.inputType,
      inputRef,
      inputHash,
      keyEnvelope,
      options: { disableReasoning: false, includeAssets: true, includeAxe: true },
      enqueuedAt: new Date().toISOString(),
    });
  } catch (err) {
    await (db as unknown as DbClient)
      .update(schema.extractions)
      .set({ status: 'failed', error: `enqueue: ${(err as Error).message}` })
      .where(eq(schema.extractions.id, extractionId));
    return NextResponse.json(
      { error: 'enqueue_failed', detail: (err as Error).message },
      { status: 502 },
    );
  }

  return NextResponse.json(
    { extractionId, streamUrl: `/api/stream/${extractionId}` },
    { status: 202 },
  );
}
