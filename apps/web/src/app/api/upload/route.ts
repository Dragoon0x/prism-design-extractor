/**
 * POST /api/upload — client-upload handler for images (and PDFs, once Phase 7 lands).
 *
 * Follows the Vercel Blob "client uploads" pattern: the client posts a tiny
 * handshake, we respond with a signed token scoped to a specific pathname,
 * the client uploads directly to Blob, and a completion callback fires so we
 * can log or clean up.
 *
 * Rate-limited per-IP to prevent abuse.
 */
import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { env } from '@/lib/env';
import { anonLimiter, clientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
] as const;

const ALLOWED_PDF_TYPES = ['application/pdf'] as const;

export async function POST(request: Request): Promise<NextResponse> {
  const ip = clientIp(request);
  const rl = await anonLimiter.limit(`upload:${ip}`);
  if (!rl.success) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': `${Math.ceil((rl.reset - Date.now()) / 1000)}` } },
    );
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const json = await handleUpload({
      body,
      request,
      token: env.BLOB_READ_WRITE_TOKEN,
      onBeforeGenerateToken: async (pathname) => {
        const isPdf = pathname.toLowerCase().endsWith('.pdf');
        return {
          allowedContentTypes: [
            ...ALLOWED_IMAGE_TYPES,
            ...(isPdf ? ALLOWED_PDF_TYPES : []),
          ],
          maximumSizeInBytes: isPdf ? env.MAX_PDF_BYTES : env.MAX_IMAGE_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ ip }),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log(`[upload] completed: ${blob.pathname} (${blob.url})`);
      },
    });
    return NextResponse.json(json);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
