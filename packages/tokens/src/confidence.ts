/**
 * Confidence math.
 *
 * After clustering, each surviving token carries a 0–1 confidence score that
 * summarizes: (a) how many independent sources saw this value, (b) how widely
 * it was used across the page, (c) how many near-duplicate siblings merged
 * into this cluster (stronger cluster = more confidence).
 *
 * The scoring intentionally caps below 1.0 so the UI has headroom to upgrade
 * a token to "verified" after a human review step.
 */
import type { EvidenceItem, Token } from '@prism/shared';

const BASE = 0.5;
const HAS_DOM_BOOST = 0.2;
const HAS_VISION_BOOST = 0.15;
const MULTI_SOURCE_BOOST = 0.1;
const HEAVY_USAGE_BOOST = 0.1;
const CLUSTER_BOOST = 0.05;
const CAP = 0.98;

const HEAVY_USAGE_THRESHOLD = 5;

/** Derive the source set from a list of evidence items. */
export function sourcesFromEvidence(evidence: EvidenceItem[]): Set<EvidenceItem['source']> {
  return new Set(evidence.map((e) => e.source));
}

/**
 * Compute the cluster-level confidence.
 * `members` are the pre-merge tokens. `combinedEvidence` is the concatenation
 * of their evidence (used for source detection).
 */
export function clusterConfidence(members: Token[], combinedEvidence: EvidenceItem[]): number {
  const sources = sourcesFromEvidence(combinedEvidence);
  const hasDom =
    sources.has('computed-style') || sources.has('dom') || sources.has('stylesheet');
  const hasVision = sources.has('vision') || sources.has('ocr');
  const totalUsage = members.reduce((sum, m) => sum + m.usageCount, 0);

  let c = BASE;
  if (hasDom) c += HAS_DOM_BOOST;
  if (hasVision) c += HAS_VISION_BOOST;
  if (hasDom && hasVision) c += MULTI_SOURCE_BOOST;
  if (totalUsage >= HEAVY_USAGE_THRESHOLD) c += HEAVY_USAGE_BOOST;
  if (members.length > 1) c += CLUSTER_BOOST;

  return Math.min(CAP, Math.max(0, c));
}
