import { describe, expect, it } from 'vitest';
import { SCHEMA_VERSION, type CanonicalExtraction, type ColorToken, type TypographyToken } from '@prism/shared';
import { parseColor } from '@prism/tokens';
import { scoreComponents, scoreFixture, scorePalette, scoreTypography } from './score.js';
import type { AnswerFile } from './answer-schema.js';

function color(hex: string, id = `color:${hex}`): ColorToken {
  return {
    id,
    name: id,
    category: 'color',
    confidence: 0.9,
    usageCount: 10,
    evidence: [{ source: 'vision', rawText: hex }],
    tags: [],
    contrast: [],
    value: parseColor(hex),
  };
}

function typo(opts: {
  family: string;
  sizePx: number;
  weight?: number;
  id?: string;
}): TypographyToken {
  const id = opts.id ?? `typo:${opts.family}-${opts.sizePx}-${opts.weight ?? 400}`;
  return {
    id,
    name: id,
    category: 'typography',
    confidence: 0.9,
    usageCount: 5,
    evidence: [{ source: 'vision', rawText: `${opts.family} ${opts.sizePx}` }],
    tags: [],
    value: {
      family: opts.family,
      fallbackStack: [],
      weight: opts.weight ?? 400,
      size: { value: opts.sizePx, unit: 'px', px: opts.sizePx },
      textTransform: 'none',
      textDecoration: 'none',
      fontStyle: 'normal',
      source: { kind: 'unknown', family: opts.family },
    },
  };
}

const baseExtraction = (): CanonicalExtraction => ({
  schemaVersion: SCHEMA_VERSION,
  extractionId: '00000000-0000-0000-0000-000000000999',
  input: {
    type: 'image',
    s3Key: 'test.png',
    inputHash: 'a'.repeat(64),
    format: 'png',
    width: 100,
    height: 100,
    bytes: 10,
  },
  meta: {
    viewports: [],
    pagesProcessed: [],
    modelsUsed: [],
    cost: {
      totalUsd: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      calls: [],
    },
    extractedAt: '2026-04-19T00:00:00.000Z',
    durationMs: 0,
    schemaVersion: SCHEMA_VERSION,
  },
  tokens: [],
  components: [],
  assets: [],
  audits: [],
  warnings: [],
});

describe('scorePalette', () => {
  it('perfect match yields F1 = 1', () => {
    const extraction = { ...baseExtraction(), tokens: [color('#3b82f6'), color('#ef4444')] };
    const answer: AnswerFile = {
      id: 't',
      palette: [{ hex: '#3b82f6' }, { hex: '#ef4444' }],
      typography: [],
      spacingPx: [],
      radiiPx: [],
      components: [],
      hasGradient: false,
      hasShadow: false,
    };
    const prf = scorePalette(answer, extraction);
    expect(prf.f1).toBe(1);
    expect(prf.truePositives).toBe(2);
  });

  it('matches within ΔE threshold', () => {
    const extraction = { ...baseExtraction(), tokens: [color('#3c82f5')] }; // near #3b82f6
    const answer: AnswerFile = {
      id: 't',
      palette: [{ hex: '#3b82f6' }],
      typography: [],
      spacingPx: [],
      radiiPx: [],
      components: [],
      hasGradient: false,
      hasShadow: false,
    };
    const prf = scorePalette(answer, extraction);
    expect(prf.truePositives).toBe(1);
  });

  it('penalizes missing colors (recall) and extra colors (precision)', () => {
    const extraction = {
      ...baseExtraction(),
      tokens: [color('#3b82f6'), color('#10b981'), color('#cccccc')],
    };
    const answer: AnswerFile = {
      id: 't',
      palette: [{ hex: '#3b82f6' }, { hex: '#ef4444' }],
      typography: [],
      spacingPx: [],
      radiiPx: [],
      components: [],
      hasGradient: false,
      hasShadow: false,
    };
    const prf = scorePalette(answer, extraction);
    expect(prf.truePositives).toBe(1);
    expect(prf.falseNegatives).toBe(1);
    expect(prf.falsePositives).toBeGreaterThan(0);
    expect(prf.f1).toBeLessThan(1);
  });
});

describe('scoreTypography', () => {
  it('matches on family + size (within tolerance) + weight', () => {
    const extraction = {
      ...baseExtraction(),
      tokens: [typo({ family: 'Inter', sizePx: 32, weight: 700 })],
    };
    const answer: AnswerFile = {
      id: 't',
      palette: [{ hex: '#000000' }],
      typography: [
        {
          role: 'heading-1',
          familyCandidates: ['Inter', 'sans-serif'],
          sizePx: 30,
          sizeToleranceAbsPx: 4,
          weight: 700,
          weightTolerance: 100,
        },
      ],
      spacingPx: [],
      radiiPx: [],
      components: [],
      hasGradient: false,
      hasShadow: false,
    };
    const prf = scoreTypography(answer, extraction);
    expect(prf.f1).toBe(1);
  });

  it('fails when family is off', () => {
    const extraction = {
      ...baseExtraction(),
      tokens: [typo({ family: 'Comic Sans', sizePx: 32 })],
    };
    const answer: AnswerFile = {
      id: 't',
      palette: [{ hex: '#000000' }],
      typography: [{ role: 'heading-1', familyCandidates: ['Inter'], sizePx: 32, sizeToleranceAbsPx: 2 }],
      spacingPx: [],
      radiiPx: [],
      components: [],
      hasGradient: false,
      hasShadow: false,
    };
    const prf = scoreTypography(answer, extraction);
    expect(prf.truePositives).toBe(0);
  });
});

describe('scoreComponents', () => {
  it('matches by kind, ignoring extras', () => {
    const extraction = {
      ...baseExtraction(),
      components: [
        {
          id: 'c1',
          kind: 'button' as const,
          name: 'button-1',
          confidence: 0.8,
          variants: [],
          props: [],
          evidence: [{ source: 'vision' as const, rawText: 'x' }],
          tags: [],
        },
        {
          id: 'c2',
          kind: 'card' as const,
          name: 'card-1',
          confidence: 0.7,
          variants: [],
          props: [],
          evidence: [{ source: 'vision' as const, rawText: 'x' }],
          tags: [],
        },
      ],
    };
    const answer: AnswerFile = {
      id: 't',
      palette: [{ hex: '#000000' }],
      typography: [],
      spacingPx: [],
      radiiPx: [],
      components: [{ kind: 'button' }, { kind: 'card' }],
      hasGradient: false,
      hasShadow: false,
    };
    const prf = scoreComponents(answer, extraction);
    expect(prf.f1).toBe(1);
  });
});

describe('scoreFixture overall', () => {
  it('gives weighted F1 across categories', () => {
    const extraction = {
      ...baseExtraction(),
      tokens: [color('#3b82f6'), typo({ family: 'Inter', sizePx: 16 })],
    };
    const answer: AnswerFile = {
      id: 't',
      palette: [{ hex: '#3b82f6' }],
      typography: [
        { role: 'body', familyCandidates: ['Inter'], sizePx: 16, sizeToleranceAbsPx: 2 },
      ],
      spacingPx: [],
      radiiPx: [],
      components: [],
      hasGradient: false,
      hasShadow: false,
    };
    const score = scoreFixture(answer, extraction);
    expect(score.overallF1).toBeGreaterThan(0.9);
  });
});
