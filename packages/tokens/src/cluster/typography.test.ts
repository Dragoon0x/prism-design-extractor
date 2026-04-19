import { describe, expect, it } from 'vitest';
import type { TypographyToken } from '@prism/shared';
import { clusterTypography } from './typography.js';

function makeTypo(opts: {
  family: string;
  sizePx: number;
  weight?: number;
  usageCount?: number;
  id?: string;
}): TypographyToken {
  const id = opts.id ?? `t-${opts.family}-${opts.sizePx}-${opts.weight ?? 400}`;
  return {
    id,
    name: id,
    category: 'typography',
    confidence: 0.7,
    usageCount: opts.usageCount ?? 1,
    evidence: [{ source: 'computed-style', rawText: `${opts.family} ${opts.sizePx}px` }],
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

describe('clusterTypography', () => {
  it('merges tokens with identical (family, sizePx, weight)', () => {
    const { tokens } = clusterTypography([
      makeTypo({ family: 'Inter', sizePx: 16, weight: 400, usageCount: 10, id: 'a' }),
      makeTypo({ family: 'Inter', sizePx: 16, weight: 400, usageCount: 5, id: 'b' }),
    ]);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.usageCount).toBe(15);
  });

  it('keeps different weights as separate tokens', () => {
    const { tokens } = clusterTypography([
      makeTypo({ family: 'Inter', sizePx: 16, weight: 400 }),
      makeTypo({ family: 'Inter', sizePx: 16, weight: 700 }),
    ]);
    expect(tokens).toHaveLength(2);
  });

  it('orders tokens by size descending', () => {
    const { tokens } = clusterTypography([
      makeTypo({ family: 'Inter', sizePx: 14, usageCount: 1 }),
      makeTypo({ family: 'Inter', sizePx: 32, usageCount: 1 }),
      makeTypo({ family: 'Inter', sizePx: 20, usageCount: 1 }),
    ]);
    expect(tokens.map((t) => t.value.size.px)).toEqual([32, 20, 14]);
    expect(tokens[0]!.name).toBe('text-1');
  });
});
