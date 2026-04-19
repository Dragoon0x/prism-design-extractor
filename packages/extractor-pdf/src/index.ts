/**
 * @prism/extractor-pdf — Phase 7.
 *
 * Public surface:
 *   - `dispatchPdfExtraction` — render + upload + fan-out. Called by the
 *     extract worker when `inputType === 'pdf'`.
 *   - `reconcilePdfFragments` — pure function that merges per-page canonical
 *     fragments into the final extraction. Called by the reconcile worker.
 *   - `renderPdfPages`, `getPdfPageCount` — low-level helpers exported for
 *     the eval harness and tests.
 */
export { dispatchPdfExtraction, type PdfPipelineInput, type PdfPipelineResult } from './pipeline.js';
export {
  reconcilePdfFragments,
  type ReconcileInput,
  type ReconcileResult,
} from './reconcile.js';
export { renderPdfPages, getPdfPageCount, type RenderedPage, type RenderPdfOptions } from './render.js';
