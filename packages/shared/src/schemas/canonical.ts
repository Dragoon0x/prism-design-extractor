/**
 * `CanonicalExtraction` — the single source of truth for one extraction run.
 *
 * Every extractor (URL, image, PDF) writes into this shape. Every output
 * generator (DESIGN.md, Tailwind, CSS, ...) reads from this shape. The
 * intelligence layer is the only package allowed to mutate token names or
 * confidence scores.
 *
 * This schema is versioned. Breaking changes bump `schemaVersion`; backwards
 * compatibility is handled by migrators in `packages/shared/src/migrations/`.
 */
import { z } from 'zod';
import { assetSchema } from './assets.js';
import { auditSchema } from './audits.js';
import { componentSchema } from './components.js';
import { metaSchema, inputRefSchema, warningSchema } from './meta.js';
import { tokenSchema } from './tokens.js';

export const SCHEMA_VERSION = '1.0.0' as const;

export const canonicalExtractionSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),

  /** Stable id for this extraction run. */
  extractionId: z.string().min(1),

  /** What was fed in. */
  input: inputRefSchema,

  /** Run metadata — viewports, cost, timing, models used. */
  meta: metaSchema,

  /**
   * All tokens extracted from this input, unioned across extraction modes
   * (DOM + vision + OCR + computed styles). Clustered, deduped, and confidence-scored.
   * The intelligence layer may add `semanticRole` after this array is populated.
   */
  tokens: z.array(tokenSchema).default([]),

  /** Detected components with variants and inferred prop surfaces. */
  components: z.array(componentSchema).default([]),

  /** Content-addressed assets (icons, images, SVGs, fonts). */
  assets: z.array(assetSchema).default([]),

  /** Consistency / a11y / debt findings. */
  audits: z.array(auditSchema).default([]),

  /** Non-fatal issues encountered during extraction. */
  warnings: z.array(warningSchema).default([]),
});

export type CanonicalExtraction = z.infer<typeof canonicalExtractionSchema>;

/**
 * Build an empty extraction skeleton. Used by extractors as the starting
 * point before they append tokens/components/assets/etc.
 */
export function makeEmptyExtraction(params: {
  extractionId: string;
  input: z.input<typeof inputRefSchema>;
  meta: z.input<typeof metaSchema>;
}): CanonicalExtraction {
  return canonicalExtractionSchema.parse({
    schemaVersion: SCHEMA_VERSION,
    extractionId: params.extractionId,
    input: params.input,
    meta: params.meta,
    tokens: [],
    components: [],
    assets: [],
    audits: [],
    warnings: [],
  });
}
