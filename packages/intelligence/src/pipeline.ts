/**
 * Intelligence pipeline — the single entry point consumed by the worker routes.
 *
 * Flow:
 *   1. Opus semantic naming (skipped gracefully on error)
 *   2. Apply namings to the extraction
 *   3. Run every deterministic audit
 *   4. Merge audits onto the extraction
 *
 * The result is a fully enriched `CanonicalExtraction` ready for persistence
 * + output generation.
 */
import type { CanonicalExtraction, Warning } from '@prism/shared';
import type { CostRecord } from '@prism/claude';
import { publishStage } from '@prism/queue';
import { applyNamings, runSemanticNaming } from './naming.js';
import { runAllAudits } from './audit.js';

export interface RunIntelligenceInput {
  extraction: CanonicalExtraction;
  apiKey: string;
  extractionId: string;
  /** Default: true. When false, skip the Opus call. */
  enableNaming?: boolean;
  /** Opus model override. */
  reasoningModel?: string;
  signal?: AbortSignal;
  onCost?: (cost: CostRecord) => void;
  /** When true, stream `intelligence-*` stage deltas. Default: true. */
  stream?: boolean;
}

export interface RunIntelligenceResult {
  extraction: CanonicalExtraction;
  warnings: Warning[];
}

export async function runIntelligence(
  input: RunIntelligenceInput,
): Promise<RunIntelligenceResult> {
  const warnings: Warning[] = [];
  let enriched = input.extraction;
  const stream = input.stream !== false;

  // --- Semantic naming ---
  if (input.enableNaming !== false) {
    if (stream) await publishStage(input.extractionId, 'intelligence-naming', 'started');
    try {
      const namings = await runSemanticNaming({
        extraction: enriched,
        apiKey: input.apiKey,
        ...(input.reasoningModel ? { model: input.reasoningModel } : {}),
        ...(input.signal ? { signal: input.signal } : {}),
        ...(input.onCost ? { onCost: input.onCost } : {}),
      });
      enriched = applyNamings(enriched, namings);
      if (stream) {
        await publishStage(input.extractionId, 'intelligence-naming', 'succeeded', {
          message: `${namings.colorNamings.length + namings.typographyNamings.length} namings`,
        });
      }
    } catch (err) {
      warnings.push({
        stage: 'intelligence-naming',
        message: `semantic naming failed: ${(err as Error).message}`,
        severity: 'warn',
      });
      if (stream) {
        await publishStage(input.extractionId, 'intelligence-naming', 'failed', {
          message: (err as Error).message,
        });
      }
    }
  } else if (stream) {
    await publishStage(input.extractionId, 'intelligence-naming', 'skipped');
  }

  // --- Audits ---
  if (stream) await publishStage(input.extractionId, 'intelligence-audits', 'started');
  const audits = runAllAudits(enriched);
  enriched = {
    ...enriched,
    audits: [...enriched.audits, ...audits],
    warnings: [...enriched.warnings, ...warnings],
  };
  if (stream) {
    await publishStage(input.extractionId, 'intelligence-audits', 'succeeded', {
      message: `${audits.length} audits`,
    });
  }

  return { extraction: enriched, warnings };
}
