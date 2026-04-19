/**
 * A small but complete CanonicalExtraction fixture. Used by snapshot tests AND
 * by the docs to show end-to-end what generator output looks like.
 */
import {
  SCHEMA_VERSION,
  type CanonicalExtraction,
  type ColorToken,
  type RadiusToken,
  type ShadowToken,
  type SpacingToken,
  type TypographyToken,
} from '@prism/shared';
import { parseColor } from '@prism/tokens';

function color(hex: string, opts: {
  id: string;
  name: string;
  semanticRole?: string;
  usage: number;
}): ColorToken {
  return {
    id: opts.id,
    name: opts.name,
    ...(opts.semanticRole ? { semanticRole: opts.semanticRole } : {}),
    category: 'color',
    confidence: 0.92,
    usageCount: opts.usage,
    evidence: [
      { source: 'computed-style', viewport: 'desktop', selector: `.${opts.name}`, rawText: hex },
    ],
    tags: ['computed-style'],
    contrast: [],
    value: parseColor(hex),
  };
}

function spacing(px: number, id: string): SpacingToken {
  return {
    id,
    name: `space-${px}`,
    category: 'spacing',
    confidence: 0.88,
    usageCount: 20,
    evidence: [{ source: 'computed-style', viewport: 'desktop', rawText: `${px}px` }],
    tags: ['computed-style'],
    spacingRole: 'scale-step',
    scaleBasePx: 4,
    scaleMultiple: px / 4,
    value: { value: px, unit: 'px', px },
  };
}

function radius(px: number, id: string): RadiusToken {
  return {
    id,
    name: `radius-${px}`,
    category: 'radius',
    confidence: 0.85,
    usageCount: 12,
    evidence: [{ source: 'computed-style', rawText: `${px}px` }],
    tags: [],
    value: { value: px, unit: 'px', px } as RadiusToken['value'],
  };
}

function typo(id: string, sizePx: number, weight: number, semanticRole?: string): TypographyToken {
  return {
    id,
    name: `text-${sizePx}`,
    ...(semanticRole ? { semanticRole } : {}),
    category: 'typography',
    confidence: 0.9,
    usageCount: 25,
    evidence: [{ source: 'computed-style', rawText: `Inter ${sizePx}px ${weight}` }],
    tags: [],
    value: {
      family: 'Inter',
      fallbackStack: ['sans-serif'],
      weight,
      size: { value: sizePx, unit: 'px', px: sizePx },
      lineHeight: { kind: 'unitless', value: 1.4 },
      textTransform: 'none',
      textDecoration: 'none',
      fontStyle: 'normal',
      source: { kind: 'unknown', family: 'Inter' },
    },
  };
}

function shadow(id: string): ShadowToken {
  return {
    id,
    name: 'shadow-sm',
    category: 'shadow',
    confidence: 0.8,
    usageCount: 8,
    evidence: [{ source: 'computed-style', rawText: '0 1px 2px rgba(0, 0, 0, 0.1)' }],
    tags: [],
    value: {
      target: 'box-shadow',
      layers: [
        {
          offsetX: { value: 0, unit: 'px', px: 0 },
          offsetY: { value: 1, unit: 'px', px: 1 },
          blur: { value: 2, unit: 'px', px: 2 },
          spread: { value: 0, unit: 'px', px: 0 },
          color: { ...parseColor('#000000'), alpha: 0.1 },
          inset: false,
        },
      ],
    },
  };
}

export function fixtureExtraction(): CanonicalExtraction {
  return {
    schemaVersion: SCHEMA_VERSION,
    extractionId: '00000000-0000-0000-0000-000000000001',
    input: {
      type: 'url',
      url: 'https://example.com',
      urlHash: 'a'.repeat(64),
    },
    meta: {
      viewports: [
        { name: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1 },
      ],
      pagesProcessed: [],
      modelsUsed: ['claude-sonnet-4-6'],
      cost: {
        totalUsd: 0.0234,
        inputTokens: 4200,
        outputTokens: 1100,
        cacheReadTokens: 3500,
        cacheCreationTokens: 700,
        calls: [
          {
            stage: 'url:vision-pass',
            model: 'claude-sonnet-4-6',
            inputTokens: 4200,
            outputTokens: 1100,
            cacheReadTokens: 3500,
            cacheCreationTokens: 700,
            costUsd: 0.0234,
            durationMs: 3200,
          },
        ],
      },
      extractedAt: '2026-04-19T12:00:00.000Z',
      durationMs: 42000,
      schemaVersion: SCHEMA_VERSION,
    },
    tokens: [
      color('#3b82f6', { id: 'color:primary', name: 'color-1', semanticRole: 'primary', usage: 140 }),
      color('#ffffff', { id: 'color:bg', name: 'color-2', semanticRole: 'background', usage: 89 }),
      color('#0f172a', { id: 'color:fg', name: 'color-3', semanticRole: 'foreground', usage: 67 }),
      color('#ef4444', { id: 'color:destructive', name: 'color-4', semanticRole: 'destructive', usage: 12 }),
      typo('typo:display', 48, 700, 'display'),
      typo('typo:heading', 24, 600, 'heading'),
      typo('typo:body', 16, 400, 'body'),
      spacing(4, 'spacing:1'),
      spacing(8, 'spacing:2'),
      spacing(16, 'spacing:3'),
      spacing(24, 'spacing:4'),
      radius(4, 'radius:sm'),
      radius(8, 'radius:md'),
      shadow('shadow:sm'),
    ],
    components: [],
    assets: [],
    audits: [],
    warnings: [],
  };
}
