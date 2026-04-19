/**
 * URL extraction pipeline. Called from the `/api/worker/extract` Vercel route.
 *
 * Stages:
 *   1. Validate + SSRF guard + robots honor
 *   2. Launch serverless Chromium
 *   3. Install asset collector + SSRF interceptor
 *   4. For each viewport: resize, navigate, wait for loadstate, capture
 *      computed styles, axe audit, take screenshot
 *   5. Vision pass on the desktop screenshot
 *   6. Fuse DOM + vision into canonical tokens
 *   7. Return the final `CanonicalExtraction`
 *
 * Deltas are published throughout via `@prism/queue/publisher`.
 */
import { assertRobotsAllowed, assertSafeUrl, installSsrfInterceptor, launchSession } from '@prism/browser';
import { SCHEMA_VERSION, type CanonicalExtraction, type ViewportName, type Warning } from '@prism/shared';
import type { CostRecord } from '@prism/claude';
import { publishDelta, publishStage } from '@prism/queue';
import { captureComputedStyles, type ComputedStylesReport } from './capture/computed-styles.js';
import { installAssetCollector } from './capture/assets.js';
import { runAxe } from './capture/axe.js';
import { fuseCanonicalTokens } from './fusion.js';
import { runVisionPass } from './vision.js';
import { VIEWPORTS } from './viewports.js';
import { clusterAll } from '@prism/tokens';

export interface UrlPipelineInput {
  extractionId: string;
  url: string;
  apiKey: string;
  visionModel?: string;
  signal?: AbortSignal;
  includeAxe?: boolean;
}

export interface UrlPipelineResult {
  canonical: CanonicalExtraction;
  screenshotsByViewport: Record<ViewportName, Buffer>;
}

export async function extractFromUrl(input: UrlPipelineInput): Promise<UrlPipelineResult> {
  const started = Date.now();
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
  };

  await publishStage(input.extractionId, 'validating', 'started');
  const safe = await assertSafeUrl(input.url);
  await assertRobotsAllowed(safe, input.signal);
  await publishStage(input.extractionId, 'validating', 'succeeded');

  await publishStage(input.extractionId, 'browser-launching', 'started');
  const session = await launchSession({ noGraphics: false });
  await publishStage(input.extractionId, 'browser-launching', 'succeeded');

  const assetCollector = installAssetCollector(session.page);
  await installSsrfInterceptor(session.page);

  const byViewport: { viewport: ViewportName; report: ComputedStylesReport }[] = [];
  const screenshots: Partial<Record<ViewportName, Buffer>> = {};
  let desktopScreenshot: Buffer | undefined;

  try {
    for (const viewport of VIEWPORTS) {
      if (input.signal?.aborted) throw new Error('aborted');
      await publishStage(input.extractionId, 'viewport-capture', 'started', {
        message: viewport.name,
      });

      await session.page.setViewportSize({ width: viewport.width, height: viewport.height });

      // First viewport does the full navigation; subsequent ones just reflow + wait.
      if (viewport === VIEWPORTS[0]) {
        await publishStage(input.extractionId, 'page-loading', 'started');
        await session.page.goto(safe.href, {
          timeout: 60_000,
          waitUntil: 'domcontentloaded',
        });
        await session.page
          .waitForLoadState('networkidle', { timeout: 20_000 })
          .catch(() => warnings.push({ stage: 'page-loading', message: 'networkidle timed out', severity: 'warn' }));
        await publishStage(input.extractionId, 'page-loading', 'succeeded');
      } else {
        await session.page.waitForTimeout(500); // let layout settle after resize
      }

      await publishStage(input.extractionId, 'computed-styles', 'started', {
        message: viewport.name,
      });
      const report = await captureComputedStyles(session.page);
      byViewport.push({ viewport: viewport.name, report });
      await publishStage(input.extractionId, 'computed-styles', 'succeeded', {
        message: `${viewport.name}: ${report.elementCount} elements`,
      });

      const shot = await session.page.screenshot({ fullPage: false, type: 'png' });
      screenshots[viewport.name] = shot;
      if (viewport.name === 'desktop') desktopScreenshot = shot;

      if (input.includeAxe !== false) {
        await publishStage(input.extractionId, 'axe-audit', 'started', {
          message: viewport.name,
        });
        try {
          const axe = await runAxe(session.page);
          await publishStage(input.extractionId, 'axe-audit', 'succeeded', {
            message: `${viewport.name}: ${axe.violations.length} violations`,
          });
        } catch (err) {
          warnings.push({
            stage: 'axe',
            message: `axe failed on ${viewport.name}: ${(err as Error).message}`,
            severity: 'warn',
          });
          await publishStage(input.extractionId, 'axe-audit', 'skipped');
        }
      }

      await publishStage(input.extractionId, 'viewport-capture', 'succeeded', {
        message: viewport.name,
      });
    }
  } finally {
    await session.dispose();
  }

  // -------------------------------------------------------------------------
  // Vision pass (one call, desktop viewport)
  // -------------------------------------------------------------------------
  let visionHint;
  if (desktopScreenshot) {
    await publishStage(input.extractionId, 'vision-call', 'started');
    try {
      visionHint = await runVisionPass({
        apiKey: input.apiKey,
        url: safe.href,
        screenshotB64: desktopScreenshot.toString('base64'),
        ...(input.visionModel ? { model: input.visionModel } : {}),
        ...(input.signal ? { signal: input.signal } : {}),
        onCost: recordCost,
      });
      await publishStage(input.extractionId, 'vision-call', 'succeeded');
    } catch (err) {
      warnings.push({
        stage: 'vision',
        message: `vision pass failed: ${(err as Error).message}`,
        severity: 'warn',
      });
      await publishStage(input.extractionId, 'vision-call', 'failed', {
        message: (err as Error).message,
      });
    }
  }

  // -------------------------------------------------------------------------
  // Fusion (raw tokens from DOM + vision, not yet clustered)
  // -------------------------------------------------------------------------
  await publishStage(input.extractionId, 'fusion', 'started');
  const fused = fuseCanonicalTokens({ byViewport, visionHint });
  warnings.push(...fused.warnings.map((w) => ({ ...w, severity: 'warn' as const })));
  await publishStage(input.extractionId, 'fusion', 'succeeded', {
    message: `${fused.tokens.length} raw tokens`,
  });

  // -------------------------------------------------------------------------
  // Clustering — ΔE colors, spacing scale detection, typography grouping, etc.
  // Stream only the clustered tokens so the UI never shows a flood of duplicates.
  // -------------------------------------------------------------------------
  await publishStage(input.extractionId, 'clustering', 'started');
  const clustered = clusterAll(fused.tokens);
  for (const token of clustered.tokens) {
    await publishDelta(input.extractionId, { type: 'token', token, op: 'add' });
  }
  await publishStage(input.extractionId, 'clustering', 'succeeded', {
    message: `${clustered.stats.outputCount}/${clustered.stats.inputCount} tokens after clustering${
      clustered.stats.detectedSpacingBasePx
        ? ` · ${clustered.stats.detectedSpacingBasePx}px spacing scale`
        : ''
    }`,
  });
  if (clustered.stats.detectedSpacingBasePx) {
    warnings.push({
      stage: 'clustering.spacing',
      message: `Detected ${clustered.stats.detectedSpacingBasePx}px base (coverage ${((clustered.stats.spacingScaleCoverage ?? 0) * 100).toFixed(0)}%)`,
      severity: 'info',
    });
  }

  const canonical: CanonicalExtraction = {
    schemaVersion: SCHEMA_VERSION,
    extractionId: input.extractionId,
    input: {
      type: 'url',
      url: safe.href,
      urlHash: 'will-be-set-by-caller', // caller fills in the hash from the job
    },
    meta: {
      viewports: [...VIEWPORTS],
      pagesProcessed: [],
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
    components: [],
    assets: [],
    audits: [],
    warnings,
  };

  return {
    canonical,
    screenshotsByViewport: Object.fromEntries(
      Object.entries(screenshots).filter(([, v]) => v !== undefined),
    ) as Record<ViewportName, Buffer>,
  };
}
