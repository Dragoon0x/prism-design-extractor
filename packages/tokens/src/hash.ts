/**
 * Stable token ids. Same value → same id, across re-extractions and across
 * DOM vs vision sources. Used by the fusion stage AND by clustering so that
 * merged clusters get a deterministic representative id.
 */
import { createHash } from 'node:crypto';

/**
 * Compute a stable id for a token. The input payload should be a normalized
 * serialization of the value (for colors: lowercase hex; for spacing: `Npx`; etc.).
 */
export function stableTokenId(category: string, normalizedPayload: string): string {
  const digest = createHash('sha256').update(normalizedPayload).digest('hex').slice(0, 16);
  return `${category}:${digest}`;
}
