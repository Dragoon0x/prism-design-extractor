import { describe, expect, it } from 'vitest';
import type { ColorToken, SpacingToken, TypographyToken } from '@prism/shared';
import { parseColor } from './color.js';
import { toDtcg } from './dtcg.js';

function makeColor(hex: string, name?: string, semanticRole?: string): ColorToken {
  return {
    id: `color:${hex}`,
    name: name ?? `color-${hex}`,
    ...(semanticRole ? { semanticRole } : {}),
    category: 'color',
    confidence: 0.9,
    usageCount: 7,
    evidence: [{ source: 'computed-style', rawText: hex }],
    tags: [],
    contrast: [],
    value: parseColor(hex),
  };
}

function makeSpacing(px: number, semanticRole?: string): SpacingToken {
  return {
    id: `spacing:${px}`,
    name: `space-${px}`,
    ...(semanticRole ? { semanticRole } : {}),
    category: 'spacing',
    confidence: 0.8,
    usageCount: 5,
    evidence: [{ source: 'computed-style', rawText: `${px}px` }],
    tags: [],
    spacingRole: 'scale-step',
    value: { value: px, unit: 'px', px },
  };
}

function makeTypo(): TypographyToken {
  return {
    id: 'typography:t1',
    name: 'text-1',
    category: 'typography',
    confidence: 0.8,
    usageCount: 3,
    evidence: [{ source: 'computed-style', rawText: 'Inter 32px' }],
    tags: [],
    value: {
      family: 'Inter',
      fallbackStack: ['sans-serif'],
      weight: 700,
      size: { value: 32, unit: 'px', px: 32 },
      lineHeight: { kind: 'unitless', value: 1.2 },
      textTransform: 'none',
      textDecoration: 'none',
      fontStyle: 'normal',
      source: { kind: 'unknown', family: 'Inter' },
    },
  };
}

describe('toDtcg', () => {
  it('prefers semanticRole over name for the leaf key', () => {
    const tree = toDtcg([makeColor('#3b82f6', 'color-1', 'primary')]);
    expect(tree.color).toBeDefined();
    expect(tree.color!['primary']).toBeDefined();
    expect(tree.color!['color-1']).toBeUndefined();
  });

  it('falls back to the machine name when no semantic role is present', () => {
    const tree = toDtcg([makeColor('#ef4444', 'color-red')]);
    expect(tree.color!['color-red']).toBeDefined();
  });

  it('encodes color $type + $value correctly', () => {
    const tree = toDtcg([makeColor('#3b82f6', 'color-1', 'primary')]);
    const t = tree.color!['primary']!;
    expect(t.$type).toBe('color');
    expect(t.$value).toBe('#3b82f6');
  });

  it('encodes spacing as dimension with px', () => {
    const tree = toDtcg([makeSpacing(16, 'md')]);
    const t = tree.spacing!['md']!;
    expect(t.$type).toBe('dimension');
    expect(t.$value).toBe('16px');
  });

  it('encodes typography as a structured object', () => {
    const tree = toDtcg([makeTypo()]);
    const t = tree.typography!['text-1']!;
    expect(t.$type).toBe('typography');
    const v = t.$value as {
      fontFamily: string[];
      fontSize: string;
      fontWeight: number;
      lineHeight: number;
    };
    expect(v.fontFamily).toEqual(['Inter', 'sans-serif']);
    expect(v.fontSize).toBe('32px');
    expect(v.fontWeight).toBe(700);
    expect(v.lineHeight).toBe(1.2);
  });

  it('preserves confidence + usage in $extensions', () => {
    const tree = toDtcg([makeColor('#3b82f6', 'color-1', 'primary')]);
    const ext = tree.color!['primary']!.$extensions;
    expect(ext?.['com.prism.confidence']).toBe(0.9);
    expect(ext?.['com.prism.usageCount']).toBe(7);
  });

  it('dedupes colliding keys with a numeric suffix', () => {
    const a = makeColor('#111111', 'base');
    const b = makeColor('#222222', 'base');
    const tree = toDtcg([a, b]);
    expect(tree.color!['base']).toBeDefined();
    expect(tree.color!['base-2']).toBeDefined();
  });
});
