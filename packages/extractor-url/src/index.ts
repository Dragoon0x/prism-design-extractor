/**
 * @prism/extractor-url — Phase 2 (Vercel-native).
 *
 * Consumers should call `extractFromUrl()` from a Vercel function handler.
 * Every extraction is a one-shot: fresh Chromium, captured screenshots, vision
 * pass, fusion, return. No pools, no long-lived state.
 */
export { extractFromUrl, type UrlPipelineInput, type UrlPipelineResult } from './pipeline.js';
export { VIEWPORTS } from './viewports.js';
export { fuseCanonicalTokens } from './fusion.js';
export { captureComputedStyles } from './capture/computed-styles.js';
export { installAssetCollector } from './capture/assets.js';
export { runAxe } from './capture/axe.js';
export { runVisionPass, visionHintSchema, type VisionHint } from './vision.js';
