/**
 * W3C DTCG (`design-tokens.json`) — the lingua franca format.
 * Delegates to `@prism/tokens/toDtcg` so there's one canonical mapping.
 */
import type { Artifact, CanonicalExtraction } from '@prism/shared';
import { toDtcg } from '@prism/tokens';
import { jsonArtifact } from './artifact.js';

export function generateDesignTokensJson(extraction: CanonicalExtraction): Artifact {
  const tree = toDtcg(extraction);
  return jsonArtifact('design-tokens-json', 'design-tokens.json', tree);
}
