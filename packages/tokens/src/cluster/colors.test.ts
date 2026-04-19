import { describe, expect, it } from 'vitest';
import type { ColorToken } from '@prism/shared';
import { parseColor } from '../color.js';
import { clusterColors } from './colors.js';

function makeColor(hex: string, usageCount = 1, id = hex): ColorToken {
  const value = parseColor(hex);
  return {
    id,
    name: id,
    category: 'color',
    confidence: 0.7,
    usageCount,
    evidence: [{ source: 'computed-style', rawText: hex }],
    tags: [],
    contrast: [],
    value,
  };
}

describe('clusterColors', () => {
  it('merges perceptually-identical colors', () => {
    const input = [
      makeColor('#3B82F6', 10, 'a'),
      makeColor('#3C82F5', 3, 'b'), // ΔE < 2.5 from a
      makeColor('#3B81F7', 2, 'c'), // ΔE < 2.5 from a
    ];
    const { tokens } = clusterColors(input);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.usageCount).toBe(15);
  });

  it('keeps clearly distinct colors separate', () => {
    const input = [
      makeColor('#3B82F6', 10, 'blue'), // blue
      makeColor('#EF4444', 5, 'red'), // red
      makeColor('#10B981', 2, 'green'), // green
    ];
    const { tokens } = clusterColors(input);
    expect(tokens).toHaveLength(3);
  });

  it('orders clusters by usage descending', () => {
    const input = [
      makeColor('#EF4444', 1, 'red'),
      makeColor('#3B82F6', 100, 'blue'),
      makeColor('#10B981', 10, 'green'),
    ];
    const { tokens } = clusterColors(input);
    expect(tokens[0]!.usageCount).toBe(100);
    expect(tokens[1]!.usageCount).toBe(10);
    expect(tokens[2]!.usageCount).toBe(1);
  });

  it('does not merge across different alpha', () => {
    const opaque = makeColor('#3B82F6', 10, 'opaque');
    const trans = makeColor('#3B82F6', 10, 'trans');
    trans.value = { ...trans.value, alpha: 0.5 };
    const { tokens } = clusterColors([opaque, trans]);
    expect(tokens).toHaveLength(2);
  });

  it('tightens or loosens the threshold', () => {
    const input = [makeColor('#3B82F6', 5, 'a'), makeColor('#4080F0', 3, 'b')];
    const strict = clusterColors(input, { thresholdDeltaE: 1 });
    expect(strict.tokens.length).toBe(2);
    const loose = clusterColors(input, { thresholdDeltaE: 10 });
    expect(loose.tokens.length).toBe(1);
  });

  it('records a merge report only for clusters with >1 member', () => {
    const input = [
      makeColor('#3B82F6', 10, 'a'),
      makeColor('#3C82F5', 3, 'b'),
      makeColor('#EF4444', 5, 'red'),
    ];
    const { mergeReport } = clusterColors(input);
    expect(mergeReport).toHaveLength(1);
    expect(mergeReport[0]!.memberIds).toContain('b');
  });

  it('gives stable ids across re-runs', () => {
    const a = clusterColors([makeColor('#3B82F6', 1, 'x1')]);
    const b = clusterColors([makeColor('#3B82F6', 1, 'x2')]);
    expect(a.tokens[0]!.id).toBe(b.tokens[0]!.id);
  });
});
