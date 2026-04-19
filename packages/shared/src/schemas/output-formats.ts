/**
 * Enumeration of the 11 output formats Prism generates from a single
 * `CanonicalExtraction`, plus the `Artifact` envelope an output generator
 * returns to the caller.
 *
 * Adding a new output format means: (1) add to `outputFormatSchema`, (2)
 * implement the generator in `packages/outputs`, (3) dispatch in
 * `packages/outputs/src/index.ts`. Nothing else should need to change.
 */
import { z } from 'zod';

export const outputFormatSchema = z.enum([
  'design-md-compact',
  'design-md-extended',
  'design-tokens-json', // W3C DTCG
  'tailwind-config',
  'css-variables',
  'scss',
  'css-in-js',
  'figma-tokens-json', // Tokens Studio schema
  'storybook-stories',
  'react-component-scaffolds',
  'style-dictionary-config',
  'docs-site-zip',
  'asset-bundle-zip',
]);
export type OutputFormat = z.infer<typeof outputFormatSchema>;

export const artifactSchema = z.object({
  format: outputFormatSchema,
  /** File / archive name the user downloads. */
  filename: z.string(),
  /** MIME type. */
  contentType: z.string(),
  /**
   * Inline text, inline base64 bytes, or an already-persisted blob key.
   * `bytes` is used for binary artifacts (ZIPs) produced by pure generators —
   * the worker route uploads them to Blob before persisting.
   */
  content: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('text'), text: z.string() }),
    z.object({
      kind: z.literal('bytes'),
      /** Base64-encoded payload. The worker decodes before uploading. */
      bytesBase64: z.string(),
    }),
    z.object({ kind: z.literal('s3'), s3Key: z.string(), bytes: z.number().int().nonnegative() }),
  ]),
  /** Content hash for caching. */
  hash: z.string(),
  /** Human-friendly size estimate. */
  sizeBytes: z.number().int().nonnegative(),
  generatedAt: z.string().datetime(),
});
export type Artifact = z.infer<typeof artifactSchema>;
