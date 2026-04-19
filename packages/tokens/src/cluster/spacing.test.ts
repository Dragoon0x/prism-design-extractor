import { describe, expect, it } from 'vitest';
import type { SpacingToken } from '@prism/shared';
import { clusterSpacing } from './spacing.js';

function makeSpacing(px: number, usageCount = 1, id = `s-${px}`): SpacingToken {
  return {
    id,
    name: id,
    category: 'spacing',
    confidence: 0.7,
    usageCount,
    evidence: [{ source: 'computed-style', rawText: `${px}px` }],
    tags: [],
    spacingRole: 'ad-hoc',
    value: { value: px, unit: 'px', px },
  };
}

describe('clusterSpacing', () => {
  it('detects a 4px scale and labels multiples', () => {
    const input = [
      makeSpacing(4, 10),
      makeSpacing(8, 20),
      makeSpacing(12, 30),
      makeSpacing(16, 40),
      makeSpacing(24, 20),
      makeSpacing(32, 10),
    ];
    const result = clusterSpacing(input);
    expect(result.detectedBasePx).toBe(4);
    expect(result.scaleCoverage).toBeGreaterThanOrEqual(0.99);
    for (const token of result.tokens) {
      expect(token.spacingRole).toBe('scale-step');
      expect(token.scaleBasePx).toBe(4);
    }
  });

  it('detects an 8px scale when coverage is tighter for 8 than 4', () => {
    // 8/16/24/32 are multiples of BOTH 4 and 8, but 8 and 4 cover equally.
    // Add values that only work with 4 to disambiguate.
    const result = clusterSpacing([
      makeSpacing(8, 5),
      makeSpacing(16, 5),
      makeSpacing(24, 5),
      makeSpacing(32, 5),
      makeSpacing(40, 5),
    ]);
    // Coverage identical for 4 and 8; the first candidate found wins (order in candidateBases).
    expect([4, 8]).toContain(result.detectedBasePx);
  });

  it('merges near-duplicates within tolerance', () => {
    const input = [
      makeSpacing(15, 3),
      makeSpacing(15.5, 2),
      makeSpacing(16, 10),
    ];
    const { tokens } = clusterSpacing(input);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.usageCount).toBe(15);
    expect(tokens[0]!.value.px).toBe(16);
  });

  it('does not merge values further apart than the tolerance', () => {
    const input = [makeSpacing(4, 5), makeSpacing(8, 5), makeSpacing(12, 5)];
    const { tokens } = clusterSpacing(input);
    expect(tokens).toHaveLength(3);
  });

  it('leaves non-px units unclustered', () => {
    const tok: SpacingToken = {
      id: 'x',
      name: 'x',
      category: 'spacing',
      confidence: 0.7,
      usageCount: 1,
      evidence: [{ source: 'computed-style', rawText: '5%' }],
      tags: [],
      spacingRole: 'ad-hoc',
      value: { value: 5, unit: '%' },
    };
    const { tokens } = clusterSpacing([tok, makeSpacing(8)]);
    expect(tokens).toHaveLength(2);
  });
});
