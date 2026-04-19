/**
 * Standalone image extraction pipeline — called from the `/api/worker/extract`
 * route when `inputType === 'image'`, and reused per-page by the PDF pipeline.
 *
 * Stages (each emits a delta):
 *   1. image-preprocessing — decode, EXIF strip, resize to ≤ 1568px, encode PNG
 *   2. vision-call — one structured tool-use call to Claude Sonnet
 *   3. fusion — map the vision report into canonical tokens + components
 *   4. clustering — run `@prism/tokens/clusterAll` to dedupe / rescale
 *   5. (caller persists)
 */
import type { CostRecord } from '@prism/claude';
import { publishDelta, publishStage } from '@prism/queue';
import {
  SCHEMA_VERSION,
  type CanonicalExtraction,
  type Component,
  type Warning,
} from '@prism/shared';
import { clusterAll } from '@prism/tokens';
import { fuseImageVisionReport } from './fusion.js';
import { preprocessImage } from './preprocess.js';
import { runImageVisionPass } from './vision.js';

export interface ImagePipelineInput {
  extractionId: string;
  /** Raw image bytes (the worker route fetches from Blob). */
  imageBytes: Buffer;
  /** Human-readable descriptor for logging / prompts (filename or URL). */
  descriptor: string;
  apiKey: string;
  visionModel?: string;
  signal?: AbortSignal;
  /** PDF page number, when this runs as part of the PDF pipeline. */
  pageNumber?: number;
  /** Whether to stream token deltas (disabled for per-page calls inside PDF). */
  stream?: boolean;
}

export interface ImagePipelineResult {
  canonical: CanonicalExtraction;
}

export async function extractFromImage(input: ImagePipelineInput): Promise<ImagePipelineResult> {
  const started = Date.now();
  const stream = input.stream !== false;
  const warnings: Warning[] = [];
  const modelsUsed = new Set<string>();
  const cost = {
    totalUsd: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    calls: [] as CostRecord[],
  };
  const recordCost = (c: CostRecord) => {
    modelsUsed.add(c.model);
    cost.totalUsd += c.costUsd;
    cost.inputTokens += c.inputTokens;
    cost.outputTokens += c.outputTokens;
    cost.cacheReadTokens += c.cacheReadTokens;
    cost.cacheCreationTokens += c.cacheCreationTokens;
    cost.calls.push(c);
    if (stream) {
      void publishDelta(input.extractionId, {
        type: 'cost',
        call: {
          stage: c.stage,
          model: c.model,
          inputTokens: c.inputTokens,
          outputTokens: c.outputTokens,
          cacheReadTokens: c.cacheReadTokens,
          cacheCreationTokens: c.cacheCreationTokens,
          costUsd: c.costUsd,
          durationMs: c.durationMs,
        },
        runningTotalUsd: cost.totalUsd,
      });
    }
  };

  // 1. Preprocess
  if (stream) await publishStage(input.extractionId, 'image-preprocessing', 'started');
  let processed;
  try {
    processed = await preprocessImage(input.imageBytes);
    if (stream) {
      await publishStage(input.extractionId, 'image-preprocessing', 'succeeded', {
        message: `${processed.originalFormat} → ${processed.widthPx}×${processed.heightPx}px PNG`,
      });
    }
  } catch (err) {
    if (stream) {
      await publishStage(input.extractionId, 'image-preprocessing', 'failed', {
        message: (err as Error).message,
      });
    }
    throw err;
  }

  // 2. Vision call
  if (stream) await publishStage(input.extractionId, 'vision-call', 'started');
  const report = await runImageVisionPass({
    imagePngB64: processed.pngBytes.toString('base64'),
    apiKey: input.apiKey,
    imageDescriptor: input.descriptor,
    widthPx: processed.widthPx,
    heightPx: processed.heightPx,
    ...(input.visionModel ? { model: input.visionModel } : {}),
    ...(input.signal ? { signal: input.signal } : {}),
    onCost: recordCost,
  });
  if (stream) {
    await publishStage(input.extractionId, 'vision-call', 'succeeded', {
      message: `${report.palette.length} palette · ${report.components.length} components`,
    });
  }

  // 3. Fusion
  if (stream) await publishStage(input.extractionId, 'fusion', 'started');
  const fused = fuseImageVisionReport(
    report,
    input.pageNumber !== undefined ? { pageNumber: input.pageNumber } : {},
  );
  warnings.push(
    ...fused.warnings.map((w) => ({ ...w, severity: 'warn' as const })),
  );
  if (stream) {
    await publishStage(input.extractionId, 'fusion', 'succeeded', {
      message: `${fused.tokens.length} raw tokens`,
    });
  }

  // 4. Clustering
  if (stream) await publishStage(input.extractionId, 'clustering', 'started');
  const clustered = clusterAll(fused.tokens);
  if (stream) {
    for (const token of clustered.tokens) {
      await publishDelta(input.extractionId, { type: 'token', token, op: 'add' });
    }
    for (const component of fused.components) {
      await publishDelta(input.extractionId, { type: 'component', component, op: 'add' });
    }
    await publishStage(input.extractionId, 'clustering', 'succeeded', {
      message: `${clustered.stats.outputCount}/${clustered.stats.inputCount} tokens after clustering`,
    });
  }

  const canonical: CanonicalExtraction = {
    schemaVersion: SCHEMA_VERSION,
    extractionId: input.extractionId,
    input: {
      type: 'image',
      s3Key: input.descriptor,
      inputHash: 'will-be-set-by-caller',
      format: 'png',
      width: processed.widthPx,
      height: processed.heightPx,
      bytes: processed.pngBytes.byteLength,
    },
    meta: {
      viewports: [],
      pagesProcessed: input.pageNumber !== undefined ? [input.pageNumber] : [],
      modelsUsed: [...modelsUsed],
      cost: {
        totalUsd: cost.totalUsd,
        inputTokens: cost.inputTokens,
        outputTokens: cost.outputTokens,
        cacheReadTokens: cost.cacheReadTokens,
        cacheCreationTokens: cost.cacheCreationTokens,
        calls: cost.calls.map((c) => ({
          stage: c.stage,
          model: c.model,
          inputTokens: c.inputTokens,
          outputTokens: c.outputTokens,
          cacheReadTokens: c.cacheReadTokens,
          cacheCreationTokens: c.cacheCreationTokens,
          costUsd: c.costUsd,
          durationMs: c.durationMs,
        })),
      },
      extractedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      schemaVersion: SCHEMA_VERSION,
    },
    tokens: clustered.tokens,
    components: fused.components,
    assets: [],
    audits: [],
    warnings,
  };

  return { canonical };
}

/**
 * Consumers that run the per-page pipeline inside PDF extraction want just the
 * fused fragment, without metadata plumbing. Re-exported for convenience.
 */
export { fuseImageVisionReport } from './fusion.js';
export { runImageVisionPass } from './vision.js';
export { preprocessImage } from './preprocess.js';
