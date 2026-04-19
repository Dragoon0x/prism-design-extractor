/**
 * /results/[id] — tabbed results view for a completed extraction.
 *
 * Server component fetches the canonical tree + artifact URLs, hands them off
 * to a client component for interactive rendering (tabs, evidence drawer).
 */
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { list } from '@vercel/blob';
import { schema, type DbClient } from '@prism/db';
import { canonicalExtractionSchema, type CanonicalExtraction, type OutputFormat } from '@prism/shared';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { ResultsView } from '@/components/results-view';
import type { ArtifactRecord } from '@/components/output-panel';

const FILENAME_TO_FORMAT: Record<string, OutputFormat> = {
  'DESIGN.md': 'design-md-compact',
  'DESIGN.extended.md': 'design-md-extended',
  'design-tokens.json': 'design-tokens-json',
  'tailwind.config.ts': 'tailwind-config',
  'tokens.css': 'css-variables',
  '_tokens.scss': 'scss',
  'tokens.ts': 'css-in-js',
  'figma-tokens.json': 'figma-tokens-json',
  'sd.config.json': 'style-dictionary-config',
  'storybook-stories.zip': 'storybook-stories',
  'react-scaffolds.zip': 'react-component-scaffolds',
  'asset-bundle.zip': 'asset-bundle-zip',
  'docs-site.zip': 'docs-site-zip',
};

async function loadArtifacts(extractionId: string): Promise<ArtifactRecord[]> {
  try {
    const { blobs } = await list({
      prefix: `extractions/${extractionId}/outputs/`,
      token: env.BLOB_READ_WRITE_TOKEN,
    });
    return blobs
      .map((b) => {
        const filename = b.pathname.split('/').pop() ?? b.pathname;
        const format = FILENAME_TO_FORMAT[filename];
        if (!format) return null;
        return { format, filename, url: b.url, bytes: b.size, hash: '' };
      })
      .filter((x): x is ArtifactRecord => x !== null);
  } catch {
    return [];
  }
}

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) notFound();

  const [row] = await (db as unknown as DbClient)
    .select()
    .from(schema.extractions)
    .where(eq(schema.extractions.id, id))
    .limit(1);

  if (!row) notFound();

  const parsed = row.canonicalTree ? canonicalExtractionSchema.safeParse(row.canonicalTree) : null;
  const canonical: CanonicalExtraction | null = parsed?.success ? parsed.data : null;

  const artifacts = row.status === 'succeeded' ? await loadArtifacts(id) : [];

  return (
    <ResultsView
      id={id}
      status={row.status}
      inputRef={row.inputRef}
      canonical={canonical}
      artifacts={artifacts}
      error={row.error ?? null}
    />
  );
}
