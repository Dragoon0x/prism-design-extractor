/**
 * Asset bundle — ZIP with a `manifest.json` cataloging every extracted asset.
 *
 * v1 scope: manifest only. Re-downloading the actual bytes from Blob into the
 * ZIP would violate the "pure generator" contract (requires network I/O). The
 * manifest carries enough info (URL, hash, MIME, dimensions) that consumers
 * can fetch on their own. Phase 11 can add an opt-in "bundle with bytes"
 * mode in the UI.
 */
import JSZip from 'jszip';
import type { Artifact, Asset, CanonicalExtraction } from '@prism/shared';
import { bytesArtifact } from './artifact.js';

interface ManifestEntry {
  id: string;
  kind: Asset['kind'];
  format: string;
  hash: string;
  bytes: number;
  width?: number;
  height?: number;
  sourceUrl?: string;
  s3Key: string;
  dedupGroup?: string;
  usageCount: number;
  guessedIconSet?: string;
}

function manifestEntry(a: Asset): ManifestEntry {
  return {
    id: a.id,
    kind: a.kind,
    format: a.format,
    hash: a.hash,
    bytes: a.bytes,
    ...(a.width !== undefined ? { width: a.width } : {}),
    ...(a.height !== undefined ? { height: a.height } : {}),
    ...(a.sourceUrl ? { sourceUrl: a.sourceUrl } : {}),
    s3Key: a.s3Key,
    ...(a.dedupGroup ? { dedupGroup: a.dedupGroup } : {}),
    usageCount: a.usageCount,
    ...(a.guessedIconSet ? { guessedIconSet: a.guessedIconSet } : {}),
  };
}

function readme(count: number): string {
  return `# Prism asset bundle

${count} asset(s) were cataloged for this extraction.

\`manifest.json\` lists every asset with its hash, format, dimensions, source
URL (if available), and storage key. To fetch the bytes, use the \`sourceUrl\`
field or the Prism API's blob endpoint for \`s3Key\`.

This bundle is the manifest only. A future Prism release will offer a
bytes-included variant (with image / icon / font data zipped in).
`;
}

export async function generateAssetBundle(extraction: CanonicalExtraction): Promise<Artifact> {
  const zip = new JSZip();
  const entries = extraction.assets.map(manifestEntry);
  zip.file(
    'manifest.json',
    JSON.stringify(
      {
        extractionId: extraction.extractionId,
        generatedAt: new Date().toISOString(),
        assetCount: entries.length,
        assets: entries,
      },
      null,
      2,
    ) + '\n',
  );
  // Inline any SVGs whose source text we already captured — they're small and
  // self-contained, so shipping them is zero cost.
  const svgs = zip.folder('svg');
  if (svgs) {
    for (const asset of extraction.assets) {
      if (asset.kind === 'svg' && asset.svgInlineSource) {
        svgs.file(`${asset.hash.slice(0, 8)}.svg`, asset.svgInlineSource);
      }
    }
  }
  zip.file('README.md', readme(entries.length));

  const bytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return bytesArtifact({
    format: 'asset-bundle-zip',
    filename: 'asset-bundle.zip',
    contentType: 'application/zip',
    bytes,
  });
}
