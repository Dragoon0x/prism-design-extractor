/**
 * POST /api/worker/generate-outputs — QStash target.
 *
 * Regenerates output artifacts for a completed extraction. Deterministic,
 * cheap, no LLM calls. Uploads each artifact to Vercel Blob.
 *
 * Triggered automatically after `/api/worker/extract` succeeds, and available
 * as a manual trigger for the UI's "regenerate" action (Phase 5+).
 */
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { put } from '@vercel/blob';
import { schema, type DbClient } from '@prism/db';
import {
  generate,
  SUPPORTED_FORMATS_V1,
  UnsupportedFormatError,
} from '@prism/outputs';
import { generateOutputsJobSchema, QStashUnauthorizedError, verifyQStashRequest } from '@prism/queue';
import { canonicalExtractionSchema, type OutputFormat } from '@prism/shared';
import { db } from '@/lib/db';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

  const parsed = generateOutputsJobSchema.safeParse(JSON.parse(rawBody));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_job', detail: parsed.error.message },
      { status: 400 },
    );
  }
  const { extractionId, formats } = parsed.data;

  const [row] = await (db as unknown as DbClient)
    .select()
    .from(schema.extractions)
    .where(eq(schema.extractions.id, extractionId))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (!row.canonicalTree) {
    return NextResponse.json({ error: 'no_canonical_tree' }, { status: 409 });
  }

  const extraction = canonicalExtractionSchema.parse(row.canonicalTree);

  const results: { format: OutputFormat; filename: string; url: string; bytes: number; hash: string }[] = [];
  const errors: { format: OutputFormat; message: string }[] = [];

  for (const raw of formats) {
    const format = raw as OutputFormat;
    try {
      const artifact = await generate(extraction, format);
      let body: string | Buffer;
      if (artifact.content.kind === 'text') {
        body = artifact.content.text;
      } else if (artifact.content.kind === 'bytes') {
        body = Buffer.from(artifact.content.bytesBase64, 'base64');
      } else {
        errors.push({ format, message: 'already-persisted artifact kind unsupported here' });
        continue;
      }
      const blob = await put(
        `extractions/${extractionId}/outputs/${artifact.filename}`,
        body,
        {
          access: 'public',
          contentType: artifact.contentType,
          token: env.BLOB_READ_WRITE_TOKEN,
        },
      );
      results.push({
        format,
        filename: artifact.filename,
        url: blob.url,
        bytes: artifact.sizeBytes,
        hash: artifact.hash,
      });
    } catch (err) {
      const message =
        err instanceof UnsupportedFormatError
          ? `format "${format}" not yet implemented`
          : (err as Error).message;
      errors.push({ format, message });
    }
  }

  return NextResponse.json({ extractionId, results, errors }, { status: 200 });
}

/** Request body used by the auto-enqueue in `/api/worker/extract`. */
export function defaultFormats(): OutputFormat[] {
  return [...SUPPORTED_FORMATS_V1];
}
