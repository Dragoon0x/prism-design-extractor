/**
 * @prism/tokens — clustering, confidence math, DTCG serialization.
 *
 * Public surface:
 *   - `clusterAll(tokens)` — one-call pipeline used by extractors.
 *   - `toDtcg(extraction | tokens)` — W3C Design Token Community Group format.
 *   - Per-category clusterers for callers that need finer control.
 *   - Color math utilities (parseColor, deltaE, contrastRatio) — see `color.ts`.
 *   - Stable id + normalization helpers for downstream packages that build
 *     their own tokens (e.g. vision-only extractors).
 */
export * from './color.js';
export * from './hash.js';
export * from './confidence.js';
export * from './normalize.js';
export * from './cluster/colors.js';
export * from './cluster/spacing.js';
export * from './cluster/typography.js';
export * from './cluster/radii.js';
export * from './cluster/shadows.js';
export * from './pipeline.js';
export * from './dtcg.js';
