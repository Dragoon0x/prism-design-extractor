/**
 * GET /api/extractions/[id] — fetch a completed extraction's canonical tree.
 * Used by the results page as the data source.
 */
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { schema, type DbClient } from '@prism/db';
import { canonicalExtractionSchema } from '@prism/shared';
import { db } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }
  const [row] = await (db as unknown as DbClient)
    .select()
    .from(schema.extractions)
    .where(eq(schema.extractions.id, id))
    .limit(1);

  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const canonical = row.canonicalTree
    ? canonicalExtractionSchema.safeParse(row.canonicalTree)
    : null;

  return NextResponse.json({
    id: row.id,
    status: row.status,
    inputType: row.inputType,
    inputRef: row.inputRef,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    costUsd: row.costUsd,
    durationMs: row.durationMs,
    error: row.error,
    canonical: canonical?.success ? canonical.data : null,
  });
}
