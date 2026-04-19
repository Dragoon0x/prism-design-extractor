/**
 * Scoring functions. Each returns precision/recall/F1 for a category; the
 * top-level `scoreFixture` combines them into an overall F1 used by the CI
 * gate.
 *
 * Weights are tuned so that palette (the most universally-extractable signal)
 * dominates, while component detection (hardest + most variable) contributes
 * without overwhelming.
 */
import type {
  CanonicalExtraction,
  ColorToken,
  RadiusToken,
  SpacingToken,
  TypographyToken,
} from '@prism/shared';
import { deltaE, parseColor } from '@prism/tokens';
import type { AnswerFile, TypographyAnswer } from './answer-schema.js';

export interface PrfScore {
  precision: number;
  recall: number;
  f1: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
}

const emptyPrf = (): PrfScore => ({
  precision: 1,
  recall: 1,
  f1: 1,
  truePositives: 0,
  falsePositives: 0,
  falseNegatives: 0,
});

function prf(tp: number, fp: number, fn: number): PrfScore {
  if (tp + fp + fn === 0) return emptyPrf();
  const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1, truePositives: tp, falsePositives: fp, falseNegatives: fn };
}

// -------------------- Palette --------------------

export function scorePalette(
  answer: AnswerFile,
  extraction: CanonicalExtraction,
): PrfScore {
  const predicted = extraction.tokens.filter((t): t is ColorToken => t.category === 'color');
  if (answer.palette.length === 0) return emptyPrf();
  const matchedPredicted = new Set<string>();
  let tp = 0;
  let fn = 0;
  for (const expected of answer.palette) {
    const threshold = expected.deltaEThreshold ?? 5;
    const expectedColor = parseColor(expected.hex);
    const hit = predicted.find((p) => {
      if (matchedPredicted.has(p.id)) return false;
      return deltaE(p.value, expectedColor) < threshold;
    });
    if (hit) {
      matchedPredicted.add(hit.id);
      tp++;
    } else {
      fn++;
    }
  }
  const fp = Math.max(0, predicted.length - matchedPredicted.size);
  return prf(tp, fp, fn);
}

// -------------------- Typography --------------------

function typographyMatches(expected: TypographyAnswer, predicted: TypographyToken): boolean {
  const families = expected.familyCandidates.map((f) => f.trim().toLowerCase());
  if (!families.includes(predicted.value.family.trim().toLowerCase())) return false;
  if (expected.sizePx !== undefined) {
    const predPx = predicted.value.size.px ?? predicted.value.size.value;
    if (Math.abs(predPx - expected.sizePx) > expected.sizeToleranceAbsPx) return false;
  }
  if (expected.weight !== undefined) {
    if (Math.abs(predicted.value.weight - expected.weight) > expected.weightTolerance) return false;
  }
  return true;
}

export function scoreTypography(
  answer: AnswerFile,
  extraction: CanonicalExtraction,
): PrfScore {
  if (answer.typography.length === 0) return emptyPrf();
  const predicted = extraction.tokens.filter(
    (t): t is TypographyToken => t.category === 'typography',
  );
  const matchedPredicted = new Set<string>();
  let tp = 0;
  let fn = 0;
  for (const expected of answer.typography) {
    const hit = predicted.find((p) => {
      if (matchedPredicted.has(p.id)) return false;
      return typographyMatches(expected, p);
    });
    if (hit) {
      matchedPredicted.add(hit.id);
      tp++;
    } else {
      fn++;
    }
  }
  const fp = Math.max(0, predicted.length - matchedPredicted.size);
  return prf(tp, fp, fn);
}

// -------------------- Spacing --------------------

export function scoreSpacing(
  answer: AnswerFile,
  extraction: CanonicalExtraction,
): PrfScore {
  if (answer.spacingPx.length === 0) return emptyPrf();
  const predicted = extraction.tokens.filter((t): t is SpacingToken => t.category === 'spacing');
  const predictedPx = predicted
    .map((t) => t.value.px ?? t.value.value)
    .filter((n) => Number.isFinite(n));

  const used = new Set<number>();
  let tp = 0;
  for (const px of answer.spacingPx) {
    const idx = predictedPx.findIndex((p, i) => !used.has(i) && Math.abs(p - px) <= 1);
    if (idx >= 0) {
      used.add(idx);
      tp++;
    }
  }
  const fn = answer.spacingPx.length - tp;
  const fp = Math.max(0, predictedPx.length - used.size);
  return prf(tp, fp, fn);
}

// -------------------- Radii --------------------

export function scoreRadii(answer: AnswerFile, extraction: CanonicalExtraction): PrfScore {
  if (answer.radiiPx.length === 0) return emptyPrf();
  const predicted = extraction.tokens.filter((t): t is RadiusToken => t.category === 'radius');
  const predictedPx = predicted
    .map((t) => ('kind' in t.value ? undefined : (t.value.px ?? t.value.value)))
    .filter((n): n is number => typeof n === 'number');

  const used = new Set<number>();
  let tp = 0;
  for (const px of answer.radiiPx) {
    const idx = predictedPx.findIndex((p, i) => !used.has(i) && Math.abs(p - px) <= 1);
    if (idx >= 0) {
      used.add(idx);
      tp++;
    }
  }
  const fn = answer.radiiPx.length - tp;
  const fp = Math.max(0, predictedPx.length - used.size);
  return prf(tp, fp, fn);
}

// -------------------- Components (by kind only; coarse) --------------------

export function scoreComponents(
  answer: AnswerFile,
  extraction: CanonicalExtraction,
): PrfScore {
  if (answer.components.length === 0) return emptyPrf();
  const predictedKinds = extraction.components.map((c) => c.kind.toLowerCase());
  const used = new Set<number>();
  let tp = 0;
  for (const expected of answer.components) {
    const kind = expected.kind.toLowerCase();
    const idx = predictedKinds.findIndex((k, i) => !used.has(i) && k === kind);
    if (idx >= 0) {
      used.add(idx);
      tp++;
    }
  }
  const fn = answer.components.length - tp;
  const fp = Math.max(0, predictedKinds.length - used.size);
  return prf(tp, fp, fn);
}

// -------------------- Presence flags --------------------

export function scorePresence(answer: AnswerFile, extraction: CanonicalExtraction): {
  gradientHit: boolean;
  shadowHit: boolean;
  gradientMiss: boolean;
  shadowMiss: boolean;
} {
  const hasGradient = extraction.tokens.some((t) => t.category === 'gradient');
  const hasShadow = extraction.tokens.some((t) => t.category === 'shadow');
  return {
    gradientHit: answer.hasGradient && hasGradient,
    shadowHit: answer.hasShadow && hasShadow,
    gradientMiss: answer.hasGradient && !hasGradient,
    shadowMiss: answer.hasShadow && !hasShadow,
  };
}

// -------------------- Overall --------------------

export interface FixtureScore {
  id: string;
  palette: PrfScore;
  typography: PrfScore;
  spacing: PrfScore;
  radii: PrfScore;
  components: PrfScore;
  presence: ReturnType<typeof scorePresence>;
  overallF1: number;
}

/** Weighted F1 across categories. Weights sum to 1; adjust cautiously (they affect the CI gate). */
const WEIGHTS = {
  palette: 0.4,
  typography: 0.2,
  components: 0.15,
  spacing: 0.15,
  radii: 0.1,
} as const;

export function scoreFixture(answer: AnswerFile, extraction: CanonicalExtraction): FixtureScore {
  const palette = scorePalette(answer, extraction);
  const typography = scoreTypography(answer, extraction);
  const spacing = scoreSpacing(answer, extraction);
  const radii = scoreRadii(answer, extraction);
  const components = scoreComponents(answer, extraction);
  const presence = scorePresence(answer, extraction);

  const overallF1 =
    palette.f1 * WEIGHTS.palette +
    typography.f1 * WEIGHTS.typography +
    components.f1 * WEIGHTS.components +
    spacing.f1 * WEIGHTS.spacing +
    radii.f1 * WEIGHTS.radii;

  return { id: answer.id, palette, typography, spacing, radii, components, presence, overallF1 };
}

export function summarizeOverall(scores: FixtureScore[]): {
  f1: number;
  count: number;
  min: number;
  max: number;
  medianF1: number;
} {
  if (scores.length === 0) return { f1: 0, count: 0, min: 0, max: 0, medianF1: 0 };
  const sorted = scores.map((s) => s.overallF1).sort((a, b) => a - b);
  const mean = sorted.reduce((sum, n) => sum + n, 0) / sorted.length;
  const medianF1 =
    sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2
      : sorted[Math.floor(sorted.length / 2)]!;
  return {
    f1: mean,
    count: scores.length,
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    medianF1,
  };
}
