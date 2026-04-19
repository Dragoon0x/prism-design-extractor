/**
 * Eval harness CLI.
 *
 *   pnpm eval                       # run against ./fixtures, threshold 0.80
 *   PRISM_FIXTURES=./other pnpm eval
 *   PRISM_F1_THRESHOLD=0.75 pnpm eval
 *
 * Exits 0 if overall F1 ≥ threshold, 1 otherwise. CI reads stdout JSON for
 * reporting. A real `ANTHROPIC_API_KEY` is required — the harness actually
 * calls Claude vision for each fixture.
 */
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { extractFromImage } from '@prism/extractor-vision';
import { loadFixtures } from './load.js';
import { scoreFixture, summarizeOverall, type FixtureScore } from './score.js';

function parseFloat01(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const n = Number.parseFloat(value);
  if (!Number.isFinite(n) || n < 0 || n > 1) return fallback;
  return n;
}

async function main(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[eval] ANTHROPIC_API_KEY is required to run the harness.');
    process.exit(1);
  }

  const fixturesRoot = resolve(
    process.env.PRISM_FIXTURES ?? resolve(process.cwd(), 'fixtures'),
  );
  const threshold = parseFloat01(process.env.PRISM_F1_THRESHOLD, 0.8);
  const reportPath = process.env.PRISM_EVAL_REPORT
    ? resolve(process.env.PRISM_EVAL_REPORT)
    : null;

  console.error(`[eval] fixtures: ${fixturesRoot}`);
  console.error(`[eval] threshold: F1 ≥ ${threshold}`);

  const bundles = await loadFixtures(fixturesRoot);
  if (bundles.length === 0) {
    console.error(
      `[eval] no fixtures found under ${fixturesRoot}/images/. Run \`pnpm --filter @prism/eval run synthesize\` to bootstrap a seed set, or drop your own PNG+JSON pairs in.`,
    );
    process.exit(1);
  }

  const scores: FixtureScore[] = [];
  for (const b of bundles) {
    const started = Date.now();
    try {
      const { canonical } = await extractFromImage({
        extractionId: `eval-${b.id}`,
        imageBytes: b.imageBytes,
        descriptor: b.id,
        apiKey,
        stream: false,
      });
      const score = scoreFixture(b.answer, canonical);
      scores.push(score);
      console.error(
        `[eval] ${b.id}: F1=${score.overallF1.toFixed(3)}  palette=${score.palette.f1.toFixed(
          2,
        )}  typo=${score.typography.f1.toFixed(2)}  comp=${score.components.f1.toFixed(2)}  (${Date.now() - started}ms)`,
      );
    } catch (err) {
      console.error(`[eval] ${b.id}: failed — ${(err as Error).message}`);
      // Treat fixture failures as 0 F1 so the gate can catch systemic errors.
      scores.push({
        id: b.id,
        palette: { precision: 0, recall: 0, f1: 0, truePositives: 0, falsePositives: 0, falseNegatives: 0 },
        typography: { precision: 0, recall: 0, f1: 0, truePositives: 0, falsePositives: 0, falseNegatives: 0 },
        spacing: { precision: 0, recall: 0, f1: 0, truePositives: 0, falsePositives: 0, falseNegatives: 0 },
        radii: { precision: 0, recall: 0, f1: 0, truePositives: 0, falsePositives: 0, falseNegatives: 0 },
        components: { precision: 0, recall: 0, f1: 0, truePositives: 0, falsePositives: 0, falseNegatives: 0 },
        presence: { gradientHit: false, shadowHit: false, gradientMiss: true, shadowMiss: true },
        overallF1: 0,
      });
    }
  }

  const overall = summarizeOverall(scores);
  const report = {
    threshold,
    overall,
    perFixture: scores,
    meta: {
      ranAt: new Date().toISOString(),
      fixtureCount: bundles.length,
      schemaVersion: 1,
    },
  };

  const json = JSON.stringify(report, null, 2);
  process.stdout.write(json + '\n');
  if (reportPath) {
    await writeFile(reportPath, json);
    console.error(`[eval] report written to ${reportPath}`);
  }

  const passed = overall.f1 >= threshold;
  console.error(
    `[eval] ${passed ? 'PASS' : 'FAIL'} · mean F1 ${overall.f1.toFixed(3)} · median ${overall.medianF1.toFixed(3)} · min ${overall.min.toFixed(3)} · max ${overall.max.toFixed(3)}`,
  );
  process.exit(passed ? 0 : 1);
}

void main().catch((err) => {
  console.error('[eval] fatal', err);
  process.exit(1);
});
