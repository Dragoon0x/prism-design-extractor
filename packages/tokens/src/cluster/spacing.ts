/**
 * Spacing scale detection and clustering.
 *
 * Two jobs:
 *   1. Detect the design's **base unit** (usually 4px or 8px): the smallest
 *      multiplier that "covers" the majority of observed values within a small
 *      tolerance. If coverage is high (>=70%), we mark that base as
 *      `scaleBasePx` and tag each token with its `scaleMultiple`.
 *   2. Merge near-duplicate values (within 1px OR 2% of each other) into one.
 *
 * Tokens with no resolvable px (% / vh / vw etc.) are passed through unclustered.
 */
import type { SpacingToken } from '@prism/shared';
import { clusterConfidence } from '../confidence.js';
import { stableTokenId } from '../hash.js';
import { lengthToPx, mergeTags, roundPx } from '../normalize.js';

export interface SpacingClusterOptions {
  /** Absolute px tolerance for merging near-duplicates. Default 1px. */
  toleranceAbsPx?: number;
  /** Relative tolerance for merging near-duplicates (fraction of value). Default 0.02. */
  toleranceRel?: number;
  /** Coverage threshold for accepting a base-unit scale. Default 0.70. */
  minScaleCoverage?: number;
  /** Candidate base units to test (px). */
  candidateBases?: number[];
}

export interface SpacingClusterResult {
  tokens: SpacingToken[];
  detectedBasePx?: number;
  scaleCoverage?: number;
}

export function clusterSpacing(
  tokens: SpacingToken[],
  options: SpacingClusterOptions = {},
): SpacingClusterResult {
  const toleranceAbsPx = options.toleranceAbsPx ?? 1;
  const toleranceRel = options.toleranceRel ?? 0.02;
  const minScaleCoverage = options.minScaleCoverage ?? 0.7;
  const candidateBases = options.candidateBases ?? [2, 3, 4, 5, 6, 8, 10, 12, 16];

  const withPx: { token: SpacingToken; px: number }[] = [];
  const passthrough: SpacingToken[] = [];
  for (const t of tokens) {
    const px = lengthToPx(t.value);
    if (px === undefined || px < 0) {
      passthrough.push(t);
    } else {
      withPx.push({ token: t, px: roundPx(px) });
    }
  }

  // Scale detection: pick the base that maximizes weighted coverage.
  let bestBase: number | undefined;
  let bestCoverage = 0;
  const totalWeight = withPx.reduce((sum, x) => sum + x.token.usageCount, 0) || 1;
  for (const base of candidateBases) {
    let covered = 0;
    for (const x of withPx) {
      if (x.px === 0) {
        covered += x.token.usageCount;
        continue;
      }
      const ratio = x.px / base;
      const rounded = Math.round(ratio);
      if (rounded === 0) continue;
      const rel = Math.abs(ratio - rounded) / rounded;
      if (rel < 0.05) covered += x.token.usageCount;
    }
    const coverage = covered / totalWeight;
    if (coverage > bestCoverage) {
      bestCoverage = coverage;
      bestBase = base;
    }
  }
  const acceptScale = bestBase !== undefined && bestCoverage >= minScaleCoverage;

  // Cluster near-duplicates greedily by ascending px.
  const sortedAsc = [...withPx].sort((a, b) => a.px - b.px);
  const buckets: { repPx: number; members: { token: SpacingToken; px: number }[] }[] = [];
  for (const x of sortedAsc) {
    const last = buckets[buckets.length - 1];
    if (
      last &&
      Math.abs(x.px - last.repPx) <= Math.max(toleranceAbsPx, last.repPx * toleranceRel)
    ) {
      last.members.push(x);
      // Let the most-used member define the representative px.
      const mostUsed = last.members.reduce((a, b) =>
        a.token.usageCount >= b.token.usageCount ? a : b,
      );
      last.repPx = mostUsed.px;
    } else {
      buckets.push({ repPx: x.px, members: [x] });
    }
  }

  const result: SpacingToken[] = buckets.map((bucket, index) => {
    const rep = bucket.members.reduce((a, b) =>
      a.token.usageCount >= b.token.usageCount ? a : b,
    ).token;
    const combinedEvidence = bucket.members.flatMap((m) => m.token.evidence);
    const totalUsage = bucket.members.reduce((sum, m) => sum + m.token.usageCount, 0);
    const repPx = bucket.repPx;
    let scaleMultiple: number | undefined;
    let spacingRole: SpacingToken['spacingRole'] = 'ad-hoc';
    if (acceptScale && bestBase !== undefined) {
      const ratio = repPx / bestBase;
      const rounded = Math.round(ratio);
      if (rounded > 0 && Math.abs(ratio - rounded) / rounded < 0.05) {
        scaleMultiple = rounded;
        spacingRole = 'scale-step';
      }
    }

    const id = stableTokenId('spacing', `${repPx}px|base=${bestBase ?? 'none'}`);
    const token: SpacingToken = {
      ...rep,
      id,
      category: 'spacing',
      name: `space-${index + 1}`,
      usageCount: totalUsage,
      confidence: clusterConfidence(
        bucket.members.map((m) => m.token),
        combinedEvidence,
      ),
      evidence: combinedEvidence.slice(0, 12),
      tags: mergeTags(bucket.members.map((m) => m.token)),
      spacingRole,
      value: { value: repPx, unit: 'px', px: repPx },
      ...(acceptScale && bestBase !== undefined ? { scaleBasePx: bestBase } : {}),
      ...(scaleMultiple !== undefined ? { scaleMultiple } : {}),
      ...(bucket.members.length > 1 ? { clusterId: id } : {}),
    };
    return token;
  });

  return {
    tokens: [...result, ...passthrough],
    ...(acceptScale && bestBase !== undefined ? { detectedBasePx: bestBase } : {}),
    scaleCoverage: bestCoverage,
  };
}
