/**
 * Color clustering via perceptual distance (ΔE2000).
 *
 * Algorithm — greedy, O(n*k) where k = final cluster count:
 *   1. Sort colors by usage count (most-used first).
 *   2. For each color, find the first existing cluster whose representative
 *      is within `threshold` ΔE. If found, merge in; otherwise start a new cluster.
 *   3. The representative is the first (most-used) color that entered the cluster.
 *
 * Defaults: threshold = 2.5 ΔE2000 — the "just noticeable difference" boundary.
 * Drop to 1.0 for stricter fidelity, bump to 5 for aggressive consolidation.
 *
 * Alpha is a separate axis — we never cluster across alpha.
 */
import type { ColorToken, EvidenceItem } from '@prism/shared';
import { deltaE } from '../color.js';
import { clusterConfidence } from '../confidence.js';
import { stableTokenId } from '../hash.js';
import { mergeTags } from '../normalize.js';

export interface ColorClusterOptions {
  /** ΔE2000 threshold below which two colors are merged. Default 2.5. */
  thresholdDeltaE?: number;
  /** Max evidence items to carry on the merged token. Default 16. */
  maxEvidence?: number;
}

export interface ColorClusterResult {
  tokens: ColorToken[];
  mergeReport: { representativeId: string; memberIds: string[] }[];
}

export function clusterColors(
  tokens: ColorToken[],
  options: ColorClusterOptions = {},
): ColorClusterResult {
  const threshold = options.thresholdDeltaE ?? 2.5;
  const maxEvidence = options.maxEvidence ?? 16;
  const sorted = [...tokens].sort((a, b) => b.usageCount - a.usageCount);

  const buckets: { rep: ColorToken; members: ColorToken[] }[] = [];

  for (const t of sorted) {
    let placed = false;
    for (const bucket of buckets) {
      if (bucket.rep.value.alpha !== t.value.alpha) continue;
      if (deltaE(bucket.rep.value, t.value) < threshold) {
        bucket.members.push(t);
        placed = true;
        break;
      }
    }
    if (!placed) buckets.push({ rep: t, members: [t] });
  }

  const mergeReport: ColorClusterResult['mergeReport'] = [];
  const result: ColorToken[] = buckets.map((bucket, index) => {
    const combinedEvidence: EvidenceItem[] = bucket.members.flatMap((m) => m.evidence);
    const uniqueEvidence: EvidenceItem[] = [];
    const seenSelectors = new Set<string>();
    for (const e of combinedEvidence) {
      const sig = `${e.source}|${e.selector ?? ''}|${e.viewport ?? ''}|${e.rawText ?? ''}`;
      if (!seenSelectors.has(sig)) {
        seenSelectors.add(sig);
        uniqueEvidence.push(e);
        if (uniqueEvidence.length >= maxEvidence) break;
      }
    }

    const id = stableTokenId('color', `${bucket.rep.value.hex}|a${bucket.rep.value.alpha.toFixed(3)}`);
    const token: ColorToken = {
      ...bucket.rep,
      id,
      category: 'color',
      name: `color-${index + 1}`,
      usageCount: bucket.members.reduce((sum, m) => sum + m.usageCount, 0),
      confidence: clusterConfidence(bucket.members, combinedEvidence),
      evidence: uniqueEvidence.length > 0 ? uniqueEvidence : bucket.rep.evidence,
      tags: mergeTags(bucket.members),
      ...(bucket.members.length > 1 ? { clusterId: id } : {}),
      contrast: [],
    };

    if (bucket.members.length > 1) {
      mergeReport.push({
        representativeId: id,
        memberIds: bucket.members.slice(1).map((m) => m.id),
      });
    }
    return token;
  });

  return { tokens: result, mergeReport };
}
