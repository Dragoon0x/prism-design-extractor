/**
 * Delta publisher. Worker routes call `publishDelta()` as each extraction stage
 * produces a typed `ExtractionDelta`; the SSE endpoint forwards those to the browser.
 *
 * Uses Upstash REST `publish` — one HTTP call per delta. At our delta rate (tens
 * per extraction) this is negligible latency and avoids holding a raw TCP socket
 * open inside a serverless function.
 */
import {
  extractionDeltaSchema,
  type ExtractionDelta,
  type ExtractionStage,
} from '@prism/shared';
import { getRedis } from './redis.js';
import { deltaChannel } from './jobs.js';

/** Validates the delta, serializes, and publishes it. Never throws; publish failures are logged and swallowed. */
export async function publishDelta(
  extractionId: string,
  delta: ExtractionDelta,
): Promise<void> {
  const parsed = extractionDeltaSchema.safeParse(delta);
  if (!parsed.success) {
    console.error('[publisher] invalid delta dropped', parsed.error.message);
    return;
  }
  const channel = deltaChannel(extractionId);
  const redis = getRedis();
  try {
    await redis.publish(channel, JSON.stringify(parsed.data));
  } catch (err) {
    console.error('[publisher] publish failed', err);
  }
}

/** Emit a `stage` delta. Sugar over `publishDelta`. */
export async function publishStage(
  extractionId: string,
  stage: ExtractionStage,
  status: 'started' | 'progress' | 'succeeded' | 'skipped' | 'failed',
  opts: { progress?: number; message?: string } = {},
): Promise<void> {
  await publishDelta(extractionId, {
    type: 'stage',
    stage,
    status,
    ...(opts.progress !== undefined ? { progress: opts.progress } : {}),
    ...(opts.message ? { message: opts.message } : {}),
    timestamp: new Date().toISOString(),
  });
}
