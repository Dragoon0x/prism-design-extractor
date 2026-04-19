/**
 * Typography clustering.
 *
 * Group by normalized (family, bucketed size-px, weight). Within each group,
 * the most-used member wins the line-height / letter-spacing. Families are
 * normalized — `"Inter", sans-serif` and `Inter` collapse. Weights normalize
 * `normal` → 400, `bold` → 700.
 */
import type { TypographyToken } from '@prism/shared';
import { clusterConfidence } from '../confidence.js';
import { stableTokenId } from '../hash.js';
import { makeTypoClusterKey, mergeTags } from '../normalize.js';

export interface TypographyClusterResult {
  tokens: TypographyToken[];
}

export function clusterTypography(tokens: TypographyToken[]): TypographyClusterResult {
  const groups = new Map<string, TypographyToken[]>();

  for (const t of tokens) {
    const key = makeTypoClusterKey(t);
    if (!key) continue;
    const mapKey = `${key.family.toLowerCase()}|${key.sizePx}|${key.weight}`;
    let arr = groups.get(mapKey);
    if (!arr) {
      arr = [];
      groups.set(mapKey, arr);
    }
    arr.push(t);
  }

  const merged: TypographyToken[] = [];
  let index = 0;
  for (const [mapKey, members] of groups) {
    const sorted = [...members].sort((a, b) => b.usageCount - a.usageCount);
    const rep = sorted[0]!;
    const combinedEvidence = members.flatMap((m) => m.evidence);
    const totalUsage = members.reduce((sum, m) => sum + m.usageCount, 0);
    const id = stableTokenId('typography', mapKey);

    merged.push({
      ...rep,
      id,
      category: 'typography',
      name: `text-${++index}`,
      usageCount: totalUsage,
      confidence: clusterConfidence(members, combinedEvidence),
      evidence: combinedEvidence.slice(0, 12),
      tags: mergeTags(members),
      ...(members.length > 1 ? { clusterId: id } : {}),
      value: rep.value,
    });
  }

  // Sort by size desc so headlines come first — output generators read in this order.
  merged.sort((a, b) => (b.value.size.px ?? 0) - (a.value.size.px ?? 0));
  merged.forEach((t, i) => {
    t.name = `text-${i + 1}`;
  });

  return { tokens: merged };
}
