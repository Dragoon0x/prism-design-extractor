/**
 * /share/[token] — public read-only results view.
 *
 * Validates the token → loads the linked extraction's canonical + artifacts
 * → renders a stripped-down version of the results view. Evidence drawer is
 * gated on the share's `exposeEvidence` flag.
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

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_\-]{20,40}$/.test(token)) notFound();

  const [share] = await (db as unknown as DbClient)
    .select()
    .from(schema.shares)
    .where(eq(schema.shares.token, token))
    .limit(1);
  if (!share) notFound();
  if (share.expiresAt && share.expiresAt.getTime() < Date.now()) notFound();

  const [row] = await (db as unknown as DbClient)
    .select()
    .from(schema.extractions)
    .where(eq(schema.extractions.id, share.extractionId))
    .limit(1);
  if (!row) notFound();

  const parsed = row.canonicalTree ? canonicalExtractionSchema.safeParse(row.canonicalTree) : null;
  const canonical: CanonicalExtraction | null = parsed?.success ? parsed.data : null;
  const artifacts = row.status === 'succeeded' ? await loadArtifacts(row.id) : [];

  // Strip evidence from tokens if the share doesn't expose it.
  const safeCanonical: CanonicalExtraction | null =
    canonical && !share.exposeEvidence
      ? {
          ...canonical,
          tokens: canonical.tokens.map((t) => ({
            ...t,
            evidence: [
              { source: t.evidence[0]?.source ?? 'vision', rawText: '[hidden in share]' },
            ],
          })),
          components: canonical.components.map((c) => ({
            ...c,
            evidence: [
              { source: c.evidence[0]?.source ?? 'vision', rawText: '[hidden in share]' },
            ],
          })),
        }
      : canonical;

  return (
    <ResultsView
      id={row.id}
      status={row.status}
      inputRef={row.inputRef}
      canonical={safeCanonical}
      artifacts={artifacts}
      error={null}
      readOnly
      shareToken={token}
    />
  );
}
