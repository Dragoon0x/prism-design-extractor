/**
 * Assets: icons, images, SVGs, and fonts that appear in the source.
 * All assets are content-addressed by hash and stored in S3; the canonical tree
 * references them by S3 key. Duplicates across pages/viewports collapse via
 * `dedupGroup`.
 */
import { z } from 'zod';

export const assetKindSchema = z.enum(['icon', 'image', 'svg', 'font']);
export type AssetKind = z.infer<typeof assetKindSchema>;

export const assetSchema = z.object({
  id: z.string(),
  kind: assetKindSchema,
  /** S3 key in the storage bucket. */
  s3Key: z.string(),
  /** SHA-256 hex digest of the original bytes. */
  hash: z.string().regex(/^[0-9a-f]{64}$/),
  /** MIME-like format tag. */
  format: z.enum([
    'png',
    'jpg',
    'webp',
    'avif',
    'gif',
    'svg',
    'ico',
    'woff2',
    'woff',
    'ttf',
    'otf',
    'unknown',
  ]),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  bytes: z.number().int().nonnegative(),
  /** The original source URL (for URL extraction). */
  sourceUrl: z.string().url().optional(),
  /** Group id that this asset is part of after dedup (identical hash elsewhere). */
  dedupGroup: z.string().optional(),
  /** Count of distinct DOM elements / pages referencing this asset. */
  usageCount: z.number().int().nonnegative().default(1),
  /** Inline-SVG contents, for icon de-duplication and recoloring. */
  svgInlineSource: z.string().optional(),
  /** Guessed icon set membership (e.g. "lucide", "heroicons", "phosphor"). */
  guessedIconSet: z.string().optional(),
});
export type Asset = z.infer<typeof assetSchema>;
