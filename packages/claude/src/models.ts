/**
 * Model constants + USD pricing table.
 *
 * IMPORTANT: update the pricing table when Anthropic publishes changes.
 * Our cost tracker reads from this table; stale numbers silently mis-charge BYOK users.
 */

/** Workhorse: vision + extraction. Every URL/image/PDF call goes here. */
export const SONNET_4_6 = 'claude-sonnet-4-6' as const;

/** Reasoning + extended thinking: semantic naming, consistency audits, debt reports, diffs. */
export const OPUS_4_7 = 'claude-opus-4-7' as const;

/** Cheap deterministic: color-name lookup, trivial classification, dedup verification. */
export const HAIKU_4_5 = 'claude-haiku-4-5-20251001' as const;

export type KnownModel = typeof SONNET_4_6 | typeof OPUS_4_7 | typeof HAIKU_4_5;

/** Role a call plays in the extraction pipeline. Used by `selectModel()` routing. */
export type ModelRole = 'vision' | 'reasoning' | 'fast';

/** USD price per million tokens. */
export interface ModelPricing {
  inputPerMTok: number;
  outputPerMTok: number;
  cacheReadPerMTok: number;
  cacheWritePerMTok: number;
}

/** Placeholder pricing — ALWAYS confirm against https://www.anthropic.com/pricing before production. */
export const MODEL_PRICING: Record<string, ModelPricing> = {
  [SONNET_4_6]: {
    inputPerMTok: 3.0,
    outputPerMTok: 15.0,
    cacheReadPerMTok: 0.3,
    cacheWritePerMTok: 3.75,
  },
  [OPUS_4_7]: {
    inputPerMTok: 15.0,
    outputPerMTok: 75.0,
    cacheReadPerMTok: 1.5,
    cacheWritePerMTok: 18.75,
  },
  [HAIKU_4_5]: {
    inputPerMTok: 1.0,
    outputPerMTok: 5.0,
    cacheReadPerMTok: 0.1,
    cacheWritePerMTok: 1.25,
  },
};

/**
 * Compute USD cost from raw token counts.
 * Cache-read tokens are billed at the (much cheaper) cache-read rate.
 * Cache-write tokens are billed at the write rate (one-time, when the cache is populated).
 */
export function estimateCostUsd(params: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
}): number {
  const pricing = MODEL_PRICING[params.model];
  if (!pricing) return 0; // unknown model — skip silently; upstream logs a warning
  const mTok = 1_000_000;
  const cacheRead = params.cacheReadTokens ?? 0;
  const cacheWrite = params.cacheCreationTokens ?? 0;
  // Regular input tokens = inputTokens - cacheRead - cacheWrite (tokens are counted in each bucket separately
  // depending on the SDK version; callers should pass bucketed values).
  return (
    (params.inputTokens * pricing.inputPerMTok) / mTok +
    (params.outputTokens * pricing.outputPerMTok) / mTok +
    (cacheRead * pricing.cacheReadPerMTok) / mTok +
    (cacheWrite * pricing.cacheWritePerMTok) / mTok
  );
}

/** Default model for each role. Callers can override per-request. */
export function defaultModelFor(role: ModelRole): KnownModel {
  switch (role) {
    case 'vision':
      return SONNET_4_6;
    case 'reasoning':
      return OPUS_4_7;
    case 'fast':
      return HAIKU_4_5;
  }
}
