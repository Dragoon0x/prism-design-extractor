/**
 * GET /api/extractions/[id]/outputs — list artifact URLs generated for the extraction.
 *
 * Reads Vercel Blob prefixed by the extraction id. Since our outputs are
 * content-addressed and the blob names are the format's filename, this is a
 * simple prefix list.
 */
import { NextResponse } from 'next/server';
import { list } from '@vercel/blob';
import { env } from '@/lib/env';
import type { OutputFormat } from '@prism/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }
  const { blobs } = await list({
    prefix: `extractions/${id}/outputs/`,
    token: env.BLOB_READ_WRITE_TOKEN,
  });

  const artifacts = blobs
    .map((b) => {
      // Strip Vercel Blob's random suffix (e.g. "tokens-AbCdEf12.css" → "tokens.css").
      const rawName = b.pathname.split('/').pop() ?? b.pathname;
      const canonical = rawName.replace(/-[A-Za-z0-9]{16,}(?=\.[^.]+$)/, '');
      const format = FILENAME_TO_FORMAT[canonical];
      if (!format) return null;
      return {
        format,
        filename: canonical,
        url: b.url,
        bytes: b.size,
        hash: '',
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return NextResponse.json({ artifacts });
}
