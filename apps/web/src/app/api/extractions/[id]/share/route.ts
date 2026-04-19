/**
 * POST /api/extractions/[id]/share — mint a public share token.
 *
 * Body: `{ expiresInHours?: number, exposeEvidence?: boolean }`
 * Returns: `{ token, url, expiresAt }`
 *
 * Rate-limited per IP. Anyone with the token can read the extraction; the
 * token is URL-safe (base64url of 18 random bytes = 24 chars). No password
 * protection in v1 — add it when real auth lands.
 */
import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { schema, type DbClient } from '@prism/db';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { anonLimiter, clientIp } from '@/lib/rate-limit';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z
  .object({
    expiresInHours: z.number().int().positive().max(24 * 90).optional(),
    exposeEvidence: z.boolean().default(true),
  })
  .default({ exposeEvidence: true });

function mintToken(): string {
  return randomBytes(18).toString('base64url');
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  const ip = clientIp(request);
  const rl = await anonLimiter.limit(`share:${ip}`);
  if (!rl.success) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const raw = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', detail: parsed.error.message },
      { status: 400 },
    );
  }

  const [extraction] = await (db as unknown as DbClient)
    .select({ id: schema.extractions.id, status: schema.extractions.status })
    .from(schema.extractions)
    .where(eq(schema.extractions.id, id))
    .limit(1);
  if (!extraction) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (extraction.status !== 'succeeded') {
    return NextResponse.json(
      { error: 'not_shareable', detail: `extraction is ${extraction.status}` },
      { status: 409 },
    );
  }

  const token = mintToken();
  const expiresAt =
    parsed.data.expiresInHours !== undefined
      ? new Date(Date.now() + parsed.data.expiresInHours * 3600_000)
      : null;

  await (db as unknown as DbClient).insert(schema.shares).values({
    token,
    extractionId: id,
    expiresAt,
    exposeEvidence: parsed.data.exposeEvidence,
  });

  log.info('share.minted', { extractionId: id, expiresAt });

  return NextResponse.json({
    token,
    url: `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/share/${token}`,
    expiresAt: expiresAt?.toISOString() ?? null,
  });
}
