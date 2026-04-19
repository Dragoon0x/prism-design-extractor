/**
 * Radius clustering. Simpler than spacing: no scale detection — designs
 * typically have a handful of radius values (`sm`/`md`/`lg`/`full`). Merge
 * near-duplicates within 1px AND 5%.
 */
import type { LengthValue, RadiusToken } from '@prism/shared';
import { clusterConfidence } from '../confidence.js';
import { stableTokenId } from '../hash.js';
import { lengthToPx, mergeTags, roundPx } from '../normalize.js';

export interface RadiusClusterResult {
  tokens: RadiusToken[];
}

export function clusterRadii(tokens: RadiusToken[]): RadiusClusterResult {
  type Entry = { token: RadiusToken; px: number };
  const simple: Entry[] = [];
  const asymmetric: RadiusToken[] = [];

  for (const t of tokens) {
    const v = t.value;
    if ('kind' in v && v.kind === 'asymmetric') {
      asymmetric.push(t);
      continue;
    }
    const px = lengthToPx(v as LengthValue);
    if (px === undefined) {
      asymmetric.push(t);
      continue;
    }
    simple.push({ token: t, px: roundPx(px) });
  }

  simple.sort((a, b) => a.px - b.px);
  const buckets: { repPx: number; members: Entry[] }[] = [];
  for (const x of simple) {
    const last = buckets[buckets.length - 1];
    if (last && Math.abs(x.px - last.repPx) <= Math.max(1, last.repPx * 0.05)) {
      last.members.push(x);
      const mostUsed = last.members.reduce((a, b) =>
        a.token.usageCount >= b.token.usageCount ? a : b,
      );
      last.repPx = mostUsed.px;
    } else {
      buckets.push({ repPx: x.px, members: [x] });
    }
  }

  const result = buckets.map((bucket, index) => {
    const rep = bucket.members.reduce((a, b) =>
      a.token.usageCount >= b.token.usageCount ? a : b,
    ).token;
    const combinedEvidence = bucket.members.flatMap((m) => m.token.evidence);
    const totalUsage = bucket.members.reduce((sum, m) => sum + m.token.usageCount, 0);
    const id = stableTokenId('radius', `${bucket.repPx}px`);
    const token: RadiusToken = {
      ...rep,
      id,
      category: 'radius',
      name: `radius-${index + 1}`,
      usageCount: totalUsage,
      confidence: clusterConfidence(
        bucket.members.map((m) => m.token),
        combinedEvidence,
      ),
      evidence: combinedEvidence.slice(0, 8),
      tags: mergeTags(bucket.members.map((m) => m.token)),
      value: { value: bucket.repPx, unit: 'px', px: bucket.repPx } as RadiusToken['value'],
      ...(bucket.members.length > 1 ? { clusterId: id } : {}),
    };
    return token;
  });

  return { tokens: [...result, ...asymmetric] };
}
