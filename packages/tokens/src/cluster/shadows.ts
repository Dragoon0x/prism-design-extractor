/**
 * Shadow deduplication. Phase 2 emits one token per unique computed `box-shadow`
 * string plus vision-derived entries. Here we simply dedupe identical string
 * representations (keeping the first-seen as representative) and roll usage
 * counts + evidence together.
 *
 * Proper shadow parsing (split into layers, extract offsets / blurs / color)
 * is a Phase 8 job — it depends on intelligence for naming ("elevation-sm",
 * "elevation-lg") and is coupled to contrast/audit logic.
 */
import type { ShadowToken } from '@prism/shared';
import { clusterConfidence } from '../confidence.js';
import { stableTokenId } from '../hash.js';
import { mergeTags } from '../normalize.js';

export interface ShadowClusterResult {
  tokens: ShadowToken[];
}

function rawKey(t: ShadowToken): string {
  // Our Phase 2 fusion leaves the raw CSS shadow in `evidence[0].rawText`;
  // that's the most reliable dedup signal until we parse layers properly.
  return `${t.value.target}|${t.evidence[0]?.rawText ?? t.id}`;
}

export function clusterShadows(tokens: ShadowToken[]): ShadowClusterResult {
  const groups = new Map<string, ShadowToken[]>();
  for (const t of tokens) {
    const k = rawKey(t);
    let arr = groups.get(k);
    if (!arr) {
      arr = [];
      groups.set(k, arr);
    }
    arr.push(t);
  }

  const merged: ShadowToken[] = [];
  let index = 0;
  for (const [k, members] of groups) {
    const sorted = [...members].sort((a, b) => b.usageCount - a.usageCount);
    const rep = sorted[0]!;
    const combinedEvidence = members.flatMap((m) => m.evidence);
    const totalUsage = members.reduce((sum, m) => sum + m.usageCount, 0);
    const id = stableTokenId('shadow', k);
    merged.push({
      ...rep,
      id,
      category: 'shadow',
      name: `shadow-${++index}`,
      usageCount: totalUsage,
      confidence: clusterConfidence(members, combinedEvidence),
      evidence: combinedEvidence.slice(0, 8),
      tags: mergeTags(members),
      ...(members.length > 1 ? { clusterId: id } : {}),
    });
  }

  return { tokens: merged };
}
