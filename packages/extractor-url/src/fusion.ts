/**
 * Fuse DOM-derived computed styles + Claude's vision hint into canonical tokens.
 *
 * This is the first, naive pass; Phase 3's `@prism/tokens/cluster` will replace
 * the coarse clustering here with ΔE2000 distance and spacing-scale fitting.
 *
 * Rules of the road:
 *   - Every token gets at least one EvidenceItem.
 *   - DOM-sourced tokens weight 0.70 confidence; vision-sourced 0.50.
 *     A token seen by BOTH gets `min(0.95, sum - 0.05)` and both evidence items.
 *   - Typography keys off the tuple (family, weight, size, lineHeight, letterSpacing).
 *   - Colors are parsed through `@prism/tokens/color` so downstream math is consistent.
 */
import { createHash } from 'node:crypto';
import {
  type ColorToken,
  type EvidenceItem,
  type GradientToken,
  type LengthUnit,
  type RadiusToken,
  type ShadowToken,
  type SpacingToken,
  type Token,
  type TypographyToken,
  type ViewportName,
} from '@prism/shared';
import { parseColor } from '@prism/tokens';
import type { ComputedStylesReport } from './capture/computed-styles.js';
import type { VisionHint } from './vision.js';

function stableId(category: string, payload: string): string {
  return `${category}:${createHash('sha256').update(payload).digest('hex').slice(0, 16)}`;
}

function lengthFromCss(value: string): { value: number; unit: string; px?: number } | undefined {
  const match = /^(-?\d*\.?\d+)(px|rem|em|%|vh|vw|ch|pt|fr|deg|rad)?$/i.exec(value.trim());
  if (!match || !match[1]) return undefined;
  const num = Number(match[1]);
  if (!Number.isFinite(num)) return undefined;
  const unit = (match[2] ?? 'px').toLowerCase();
  const px = unit === 'px' ? num : unit === 'rem' || unit === 'em' ? num * 16 : undefined;
  return { value: num, unit, ...(px !== undefined ? { px } : {}) };
}

function makeEvidence(params: {
  selector: string;
  viewport: ViewportName;
  source: EvidenceItem['source'];
  rawText: string;
  elementState?: EvidenceItem['elementState'];
}): EvidenceItem {
  return {
    source: params.source,
    selector: params.selector,
    viewport: params.viewport,
    rawText: params.rawText,
    ...(params.elementState ? { elementState: params.elementState } : {}),
  };
}

export interface FusionInputs {
  byViewport: { viewport: ViewportName; report: ComputedStylesReport }[];
  visionHint?: VisionHint | undefined;
}

export interface FusionOutput {
  tokens: Token[];
  warnings: { stage: string; message: string }[];
}

export function fuseCanonicalTokens(input: FusionInputs): FusionOutput {
  const tokens: Token[] = [];
  const warnings: { stage: string; message: string }[] = [];

  // -------------------------------------------------------------------------
  // Colors (foreground + background; border colors roll into one map for now)
  // -------------------------------------------------------------------------
  const colorAgg = new Map<string, { count: number; evidence: EvidenceItem[]; sources: Set<string> }>();

  for (const { viewport, report } of input.byViewport) {
    const push = (value: string, source: EvidenceItem['source'], selector: string) => {
      try {
        const parsed = parseColor(value);
        const key = parsed.hex + '|' + parsed.alpha.toFixed(3);
        let bucket = colorAgg.get(key);
        if (!bucket) {
          bucket = { count: 0, evidence: [], sources: new Set() };
          colorAgg.set(key, bucket);
        }
        bucket.count++;
        bucket.sources.add(source);
        if (bucket.evidence.length < 8) {
          bucket.evidence.push(makeEvidence({ selector, viewport, source, rawText: value }));
        }
      } catch {
        // not a simple color (e.g. "bg-image:url(...)") — ignore
      }
    };

    for (const c of report.colors.foreground) {
      for (const sel of c.sampleSelectors) push(c.value, 'computed-style', sel);
    }
    for (const c of report.colors.background) {
      for (const sel of c.sampleSelectors) push(c.value, 'computed-style', sel);
    }
    for (const c of report.colors.border) {
      for (const sel of c.sampleSelectors) push(c.value, 'computed-style', sel);
    }
  }

  if (input.visionHint) {
    for (const p of input.visionHint.palette) {
      try {
        const parsed = parseColor(p.hex);
        const key = parsed.hex + '|1.000';
        let bucket = colorAgg.get(key);
        if (!bucket) {
          bucket = { count: 0, evidence: [], sources: new Set() };
          colorAgg.set(key, bucket);
        }
        bucket.sources.add('vision');
        bucket.evidence.push({
          source: 'vision',
          viewport: 'desktop',
          rawText: `${p.hex}${p.role ? ` (${p.role})` : ''}`,
        });
      } catch {
        warnings.push({ stage: 'fusion.colors', message: `vision returned invalid hex "${p.hex}"` });
      }
    }
  }

  let colorIndex = 0;
  for (const [key, bucket] of colorAgg) {
    const hex = key.split('|')[0] ?? '#000000';
    const alpha = Number(key.split('|')[1] ?? '1');
    const parsed = parseColor(hex);
    const hasDom = bucket.sources.has('computed-style');
    const hasVision = bucket.sources.has('vision');
    const confidence = hasDom && hasVision ? 0.95 : hasDom ? 0.7 : 0.5;
    const token: ColorToken = {
      id: stableId('color', key),
      category: 'color',
      name: `color-${++colorIndex}`,
      confidence,
      usageCount: bucket.count,
      evidence: bucket.evidence.length > 0
        ? bucket.evidence
        : [{ source: 'computed-style', rawText: hex }],
      tags: [...bucket.sources],
      contrast: [],
      value: { ...parsed, alpha },
    };
    tokens.push(token);
  }

  // -------------------------------------------------------------------------
  // Typography (bucket by full tuple for now; Phase 3 will cluster by family+size)
  // -------------------------------------------------------------------------
  const typoAgg = new Map<
    string,
    {
      count: number;
      evidence: EvidenceItem[];
      sample: ComputedStylesReport['typography'][number];
    }
  >();
  for (const { viewport, report } of input.byViewport) {
    for (const t of report.typography) {
      let bucket = typoAgg.get(t.value);
      if (!bucket) {
        bucket = { count: 0, evidence: [], sample: t };
        typoAgg.set(t.value, bucket);
      }
      bucket.count += t.count;
      for (const sel of t.sampleSelectors) {
        if (bucket.evidence.length < 8) {
          bucket.evidence.push(makeEvidence({ selector: sel, viewport, source: 'computed-style', rawText: t.value }));
        }
      }
    }
  }

  let typoIndex = 0;
  for (const [, bucket] of typoAgg) {
    const s = bucket.sample;
    const sizeLen = lengthFromCss(s.size);
    if (!sizeLen) continue;
    const families = s.family
      .split(',')
      .map((f) => f.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
    const primary = families[0] ?? 'sans-serif';
    const fallback = families.slice(1);
    const weight = Number.parseInt(s.weight, 10) || 400;
    const letterSpacing =
      s.letterSpacing === 'normal' ? undefined : lengthFromCss(s.letterSpacing);
    const token: TypographyToken = {
      id: stableId('typography', bucket.sample.value),
      category: 'typography',
      name: `text-${++typoIndex}`,
      confidence: 0.7,
      usageCount: bucket.count,
      evidence: bucket.evidence,
      tags: ['from-computed-style'],
      value: {
        family: primary,
        fallbackStack: fallback,
        weight,
        size: {
          value: sizeLen.value,
          unit: sizeLen.unit as TypographyToken['value']['size']['unit'],
          ...(sizeLen.px !== undefined ? { px: sizeLen.px } : {}),
        },
        ...(s.lineHeight && s.lineHeight !== 'normal'
          ? (() => {
              const n = Number(s.lineHeight);
              if (Number.isFinite(n)) return { lineHeight: { kind: 'unitless' as const, value: n } };
              const lenLh = lengthFromCss(s.lineHeight);
              if (lenLh) {
                return {
                  lineHeight: {
                    kind: 'length' as const,
                    value: {
                      value: lenLh.value,
                      unit: lenLh.unit as TypographyToken['value']['size']['unit'],
                      ...(lenLh.px !== undefined ? { px: lenLh.px } : {}),
                    },
                  },
                };
              }
              return {};
            })()
          : {}),
        ...(letterSpacing
          ? {
              letterSpacing: {
                value: letterSpacing.value,
                unit: letterSpacing.unit as TypographyToken['value']['size']['unit'],
                ...(letterSpacing.px !== undefined ? { px: letterSpacing.px } : {}),
              },
            }
          : {}),
        textTransform: (s.textTransform as TypographyToken['value']['textTransform']) ?? 'none',
        textDecoration:
          (s.textDecoration === 'none'
            ? 'none'
            : s.textDecoration.includes('underline')
              ? 'underline'
              : s.textDecoration.includes('line-through')
                ? 'line-through'
                : s.textDecoration.includes('overline')
                  ? 'overline'
                  : 'none') as TypographyToken['value']['textDecoration'],
        fontStyle: (s.fontStyle as TypographyToken['value']['fontStyle']) ?? 'normal',
        source: { kind: 'unknown', family: primary },
      },
    };
    tokens.push(token);
  }

  // -------------------------------------------------------------------------
  // Spacing (padding + margin + gap pooled; Phase 3 clusters into a scale)
  // -------------------------------------------------------------------------
  const spacingAgg = new Map<string, { count: number; evidence: EvidenceItem[] }>();
  for (const { viewport, report } of input.byViewport) {
    for (const group of [report.spacing.padding, report.spacing.margin, report.spacing.gap]) {
      for (const s of group) {
        let bucket = spacingAgg.get(s.value);
        if (!bucket) {
          bucket = { count: 0, evidence: [] };
          spacingAgg.set(s.value, bucket);
        }
        bucket.count += s.count;
        for (const sel of s.sampleSelectors) {
          if (bucket.evidence.length < 8) {
            bucket.evidence.push(
              makeEvidence({ selector: sel, viewport, source: 'computed-style', rawText: s.value }),
            );
          }
        }
      }
    }
  }
  let spacingIndex = 0;
  for (const [value, bucket] of spacingAgg) {
    const len = lengthFromCss(value);
    if (!len) continue;
    const token: SpacingToken = {
      id: stableId('spacing', value),
      category: 'spacing',
      name: `space-${++spacingIndex}`,
      confidence: 0.7,
      usageCount: bucket.count,
      evidence: bucket.evidence,
      tags: ['from-computed-style'],
      spacingRole: 'ad-hoc',
      value: {
        value: len.value,
        unit: len.unit as SpacingToken['value']['unit'],
        ...(len.px !== undefined ? { px: len.px } : {}),
      },
    };
    tokens.push(token);
  }

  // -------------------------------------------------------------------------
  // Radii
  // -------------------------------------------------------------------------
  const radiusAgg = new Map<string, { count: number; evidence: EvidenceItem[] }>();
  for (const { viewport, report } of input.byViewport) {
    for (const r of report.radii) {
      let bucket = radiusAgg.get(r.value);
      if (!bucket) {
        bucket = { count: 0, evidence: [] };
        radiusAgg.set(r.value, bucket);
      }
      bucket.count += r.count;
      for (const sel of r.sampleSelectors) {
        if (bucket.evidence.length < 6) {
          bucket.evidence.push(
            makeEvidence({ selector: sel, viewport, source: 'computed-style', rawText: r.value }),
          );
        }
      }
    }
  }
  let radiusIndex = 0;
  for (const [value, bucket] of radiusAgg) {
    const len = lengthFromCss(value);
    if (!len) continue;
    const token: RadiusToken = {
      id: stableId('radius', value),
      category: 'radius',
      name: `radius-${++radiusIndex}`,
      confidence: 0.7,
      usageCount: bucket.count,
      evidence: bucket.evidence,
      tags: ['from-computed-style'],
      value: {
        value: len.value,
        unit: len.unit as LengthUnit,
        ...(len.px !== undefined ? { px: len.px } : {}),
      } as RadiusToken['value'],
    };
    tokens.push(token);
  }

  // -------------------------------------------------------------------------
  // Shadows (DOM raw values + vision descriptions as separate tokens for now)
  // -------------------------------------------------------------------------
  let shadowIndex = 0;
  for (const { viewport, report } of input.byViewport) {
    for (const s of report.shadows) {
      const token: ShadowToken = {
        id: stableId('shadow', s.value + s.target),
        category: 'shadow',
        name: `shadow-${++shadowIndex}`,
        confidence: 0.6,
        usageCount: s.count,
        evidence: s.sampleSelectors.map((sel) =>
          makeEvidence({ selector: sel, viewport, source: 'computed-style', rawText: s.value }),
        ),
        tags: ['from-computed-style-raw'],
        value: {
          target: s.target === 'text' ? 'text-shadow' : s.target === 'filter-drop' ? 'drop-shadow' : 'box-shadow',
          // Layer parsing is a Phase 3 job; for now we store a single opaque layer stub.
          layers: [
            {
              offsetX: { value: 0, unit: 'px', px: 0 },
              offsetY: { value: 0, unit: 'px', px: 0 },
              blur: { value: 0, unit: 'px', px: 0 },
              spread: { value: 0, unit: 'px', px: 0 },
              color: parseColor('#000000'),
              inset: false,
            },
          ],
        },
      };
      tokens.push(token);
    }
  }

  // -------------------------------------------------------------------------
  // Gradients (vision-derived only — DOM computed styles don't parse them)
  // -------------------------------------------------------------------------
  if (input.visionHint) {
    let gradIndex = 0;
    for (const g of input.visionHint.gradients) {
      const stops = g.stops
        .map((s) => {
          try {
            return {
              color: parseColor(s.hex),
              ...(s.position !== undefined ? { position: s.position } : {}),
            };
          } catch {
            return undefined;
          }
        })
        .filter((x): x is NonNullable<typeof x> => x !== undefined);
      if (stops.length < 2) continue;
      const token: GradientToken = {
        id: stableId('gradient', JSON.stringify({ k: g.kind, a: g.angleDeg, s: stops.map((x) => x.color.hex) })),
        category: 'gradient',
        name: `gradient-${++gradIndex}`,
        confidence: 0.6,
        usageCount: 1,
        evidence: [{ source: 'vision', viewport: 'desktop', rawText: g.description }],
        tags: ['from-vision'],
        value:
          g.kind === 'radial'
            ? { kind: 'radial', shape: 'ellipse', position: 'center', stops, repeating: false }
            : g.kind === 'conic'
              ? { kind: 'conic', fromDeg: 0, stops }
              : { kind: 'linear', angleDeg: g.angleDeg ?? 180, stops, repeating: false },
      };
      tokens.push(token);
    }
  }

  return { tokens, warnings };
}
