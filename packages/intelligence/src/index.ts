/**
 * @prism/intelligence — Phase 8.
 *
 * Public surface:
 *   - `runIntelligence(extraction, …)` — top-level pipeline. Opus naming + all audits.
 *   - `runSemanticNaming()` / `applyNamings()` — lower-level naming access.
 *   - `runAllAudits()` and per-kind audits — pure, deterministic.
 *   - `diffCanonicals()` — structured diff between two extractions.
 */
export {
  runIntelligence,
  type RunIntelligenceInput,
  type RunIntelligenceResult,
} from './pipeline.js';
export {
  runSemanticNaming,
  applyNamings,
  tokenContrast,
  namingResultSchema,
  type NamingResult,
  type RunSemanticNamingInput,
} from './naming.js';
export {
  runAllAudits,
  summarizeAudits,
  auditContrast,
  auditColorDuplicates,
  auditSpacing,
  auditRadii,
  auditMissingNames,
  auditOrphans,
} from './audit.js';
export { diffCanonicals, type CanonicalDiff, type TokenDiffEntry } from './diff.js';
