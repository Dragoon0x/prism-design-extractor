/**
 * PDF reconcile — merges per-page canonical fragments into the final extraction.
 *
 * Cross-page rules:
 *   1. Tokens seen on ≥40% of pages get a `pdf-primary` tag + confidence boost
 *      (they're the design system's core, not page-specific decoration).
 *   2. Tokens seen on <10% of pages get a `pdf-rare` tag + confidence dampener
 *      (often one-off illustrations or photographic accents).
 *   3. Everything else flows through at its existing confidence.
 *   4. After tagging, `clusterAll` collapses near-duplicates that any single
 *      page alone couldn't see.
 */
import {
  SCHEMA_VERSION,
  canonicalExtractionSchema,
  type CanonicalExtraction,
  type Component,
  type ModelCall,
  type Token,
  type Warning,
} from '@prism/shared';
import { clusterAll } from '@prism/tokens';

const PRIMARY_THRESHOLD = 0.4;
const RARE_THRESHOLD = 0.1;

export interface ReconcileInput {
  extractionId: string;
  inputHash: string;
  pdfBlobUrl: string;
  pdfBytes: number;
  totalPages: number;
  fragments: { pageNumber: number; fragment: CanonicalExtraction }[];
  startedAt: Date;
}

export interface ReconcileResult {
  canonical: CanonicalExtraction;
  stats: {
    inputTokens: number;
    outputTokens: number;
    clusteredTokens: number;
    primaryTokens: number;
    rareTokens: number;
  };
}

export function reconcilePdfFragments(input: ReconcileInput): ReconcileResult {
  // 1. Tally page frequency per token id.
  const pageFrequency = new Map<string, Set<number>>();
  for (const { pageNumber, fragment } of input.fragments) {
    for (const token of fragment.tokens) {
      let set = pageFrequency.get(token.id);
      if (!set) {
        set = new Set<number>();
        pageFrequency.set(token.id, set);
      }
      set.add(pageNumber);
    }
  }

  // 2. Tag + confidence-adjust every token based on page frequency.
  const allTokens: Token[] = [];
  for (const { fragment } of input.fragments) {
    for (const token of fragment.tokens) {
      const pagesSeen = pageFrequency.get(token.id)?.size ?? 1;
      const fraction = pagesSeen / input.totalPages;
      const tags = new Set(token.tags);
      let confidence = token.confidence;
      if (fraction >= PRIMARY_THRESHOLD) {
        tags.add('pdf-primary');
        confidence = Math.min(0.98, confidence + 0.1);
      } else if (fraction < RARE_THRESHOLD) {
        tags.add('pdf-rare');
        confidence = Math.max(0.2, confidence - 0.1);
      }
      allTokens.push({ ...token, tags: [...tags].sort(), confidence });
    }
  }

  // 3. Cluster across pages. Same-value tokens from different pages get their
  // usage counts summed and evidence merged.
  const clustered = clusterAll(allTokens);

  // 4. Aggregate the remaining canonical fields.
  const allComponents: Component[] = input.fragments.flatMap(
    (f) => f.fragment.components,
  );
  const allAssets = input.fragments.flatMap((f) => f.fragment.assets);
  const allAudits = input.fragments.flatMap((f) => f.fragment.audits);
  const allWarnings: Warning[] = input.fragments.flatMap((f) => f.fragment.warnings);

  const calls: ModelCall[] = input.fragments.flatMap((f) => f.fragment.meta.cost.calls);
  const modelsUsed = [
    ...new Set(input.fragments.flatMap((f) => f.fragment.meta.modelsUsed)),
  ];
  const costTotals = calls.reduce(
    (acc, c) => ({
      totalUsd: acc.totalUsd + c.costUsd,
      inputTokens: acc.inputTokens + c.inputTokens,
      outputTokens: acc.outputTokens + c.outputTokens,
      cacheReadTokens: acc.cacheReadTokens + c.cacheReadTokens,
      cacheCreationTokens: acc.cacheCreationTokens + c.cacheCreationTokens,
    }),
    { totalUsd: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 },
  );

  const pagesProcessed = input.fragments.map((f) => f.pageNumber).sort((a, b) => a - b);

  const canonicalCandidate: CanonicalExtraction = {
    schemaVersion: SCHEMA_VERSION,
    extractionId: input.extractionId,
    input: {
      type: 'pdf',
      s3Key: input.pdfBlobUrl,
      inputHash: input.inputHash,
      pages: input.totalPages,
      bytes: input.pdfBytes,
    },
    meta: {
      viewports: [],
      pagesProcessed,
      modelsUsed,
      cost: { ...costTotals, calls },
      extractedAt: new Date().toISOString(),
      durationMs: Date.now() - input.startedAt.getTime(),
      schemaVersion: SCHEMA_VERSION,
    },
    tokens: clustered.tokens,
    components: allComponents,
    assets: allAssets,
    audits: allAudits,
    warnings: allWarnings,
  };

  const canonical = canonicalExtractionSchema.parse(canonicalCandidate);

  const primaryCount = canonical.tokens.filter((t) => t.tags.includes('pdf-primary')).length;
  const rareCount = canonical.tokens.filter((t) => t.tags.includes('pdf-rare')).length;

  return {
    canonical,
    stats: {
      inputTokens: costTotals.inputTokens,
      outputTokens: costTotals.outputTokens,
      clusteredTokens: canonical.tokens.length,
      primaryTokens: primaryCount,
      rareTokens: rareCount,
    },
  };
}
