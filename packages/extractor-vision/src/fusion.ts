/**
 * Fuse a vision report into canonical tokens.
 *
 * Unlike URL fusion (DOM + vision), image fusion is vision-only. Confidence
 * follows the vision's self-reported confidence plus a source weighting.
 * Clustering happens AFTER this step, in `@prism/tokens/clusterAll`.
 */
import { createHash } from 'node:crypto';
import type {
  Component,
  ComponentKind,
  EvidenceItem,
  GradientToken,
  RadiusToken,
  ShadowLayer,
  ShadowToken,
  SpacingToken,
  Token,
  TypographyToken,
} from '@prism/shared';
import { parseColor } from '@prism/tokens';
import type { ImageVisionReport } from './vision-schema.js';

function stableId(category: string, payload: string): string {
  return `${category}:${createHash('sha256').update(payload).digest('hex').slice(0, 16)}`;
}

function visionEvidence(rawText: string, pageNumber?: number): EvidenceItem {
  return {
    source: 'vision',
    rawText,
    ...(pageNumber ? { pageNumber } : {}),
  };
}

function lengthPx(px: number) {
  return { value: px, unit: 'px' as const, px };
}

/**
 * Translate a `ShadowLayerEntry` (color + alpha separate) into our canonical
 * `ShadowLayer` shape (single ColorValue with alpha).
 */
function shadowLayerFromEntry(entry: ImageVisionReport['shadows'][number]['layers'][number]): ShadowLayer {
  const base = parseColor(entry.color);
  return {
    offsetX: lengthPx(entry.offsetX),
    offsetY: lengthPx(entry.offsetY),
    blur: lengthPx(entry.blur),
    spread: lengthPx(entry.spread),
    color: { ...base, alpha: entry.alpha },
    inset: entry.inset,
  };
}

const COMPONENT_KINDS = new Set<ComponentKind>([
  'button', 'card', 'input', 'textarea', 'select', 'checkbox', 'radio', 'switch',
  'badge', 'chip', 'nav', 'navbar', 'sidebar', 'tabs', 'tab', 'modal', 'dialog',
  'popover', 'tooltip', 'toast', 'banner', 'alert', 'avatar', 'breadcrumb',
  'pagination', 'progress', 'slider', 'dropdown', 'menu', 'list', 'list-item',
  'table', 'footer', 'header', 'hero', 'feature', 'pricing-card', 'testimonial',
  'icon', 'logo', 'unknown',
]);

export interface FuseImageOptions {
  /** PDF page number this report came from, propagated into evidence. */
  pageNumber?: number;
}

export interface FusedImageExtraction {
  tokens: Token[];
  components: Component[];
  warnings: { stage: string; message: string }[];
}

export function fuseImageVisionReport(
  report: ImageVisionReport,
  options: FuseImageOptions = {},
): FusedImageExtraction {
  const tokens: Token[] = [];
  const components: Component[] = [];
  const warnings: { stage: string; message: string }[] = [];

  // ----- Colors -----
  let colorIndex = 0;
  for (const entry of report.palette) {
    try {
      const value = parseColor(entry.hex);
      const id = stableId('color', `${value.hex}|a1.000`);
      const usage = Math.max(1, Math.round((entry.approximateArea ?? 0.05) * 100));
      tokens.push({
        id,
        category: 'color',
        name: entry.role ?? `color-${++colorIndex}`,
        ...(entry.role ? { semanticRole: entry.role } : {}),
        confidence: 0.6,
        usageCount: usage,
        evidence: [visionEvidence(`${entry.hex}${entry.role ? ` (${entry.role})` : ''}${entry.note ? ` — ${entry.note}` : ''}`, options.pageNumber)],
        tags: ['from-vision'],
        contrast: [],
        value,
      });
    } catch {
      warnings.push({ stage: 'vision-fusion.colors', message: `invalid hex from vision: ${entry.hex}` });
    }
  }

  // ----- Typography -----
  let typoIndex = 0;
  for (const entry of report.typography) {
    const sizePx = Math.round(entry.sizePxHint);
    if (sizePx <= 0) continue;
    const name = entry.role === 'other' ? `text-${++typoIndex}` : entry.role;
    const token: TypographyToken = {
      id: stableId('typography', `${entry.familyHint}|${sizePx}|${entry.weightHint}`),
      category: 'typography',
      name,
      ...(entry.role !== 'other' ? { semanticRole: entry.role } : {}),
      confidence: entry.confidence,
      usageCount: 1,
      evidence: [
        visionEvidence(
          `${entry.familyHint} ${sizePx}px wt ${entry.weightHint}${
            entry.sampleText ? ` — "${entry.sampleText.slice(0, 80)}"` : ''
          }`,
          options.pageNumber,
        ),
      ],
      tags: ['from-vision'],
      value: {
        family: entry.familyHint,
        fallbackStack: [],
        weight: entry.weightHint,
        size: lengthPx(sizePx),
        ...(entry.lineHeightPxHint !== undefined
          ? {
              lineHeight: {
                kind: 'length' as const,
                value: lengthPx(Math.round(entry.lineHeightPxHint)),
              },
            }
          : {}),
        ...(entry.letterSpacingPxHint !== undefined
          ? { letterSpacing: lengthPx(entry.letterSpacingPxHint) }
          : {}),
        textTransform: entry.uppercase ? 'uppercase' : 'none',
        textDecoration: 'none',
        fontStyle: entry.italic ? 'italic' : 'normal',
        source: { kind: 'unknown', family: entry.familyHint },
      },
    };
    tokens.push(token);
  }

  // ----- Spacing -----
  let spacingIndex = 0;
  for (const entry of report.spacing) {
    const px = Math.round(entry.pxHint);
    if (px < 0) continue;
    const token: SpacingToken = {
      id: stableId('spacing', `${px}px|vision`),
      category: 'spacing',
      name: `space-${++spacingIndex}`,
      confidence: entry.confidence,
      usageCount: 1,
      evidence: [visionEvidence(`${px}px spacing${entry.role ? ` (${entry.role})` : ''}`, options.pageNumber)],
      tags: ['from-vision'],
      spacingRole: 'ad-hoc',
      value: lengthPx(px),
    };
    tokens.push(token);
  }

  // ----- Radii -----
  let radiusIndex = 0;
  for (const entry of report.radii) {
    const px = Math.round(entry.pxHint);
    if (px < 0) continue;
    const token: RadiusToken = {
      id: stableId('radius', `${px}px|vision`),
      category: 'radius',
      name: `radius-${++radiusIndex}`,
      confidence: entry.confidence,
      usageCount: 1,
      evidence: [visionEvidence(`${px}px radius${entry.target ? ` (${entry.target})` : ''}`, options.pageNumber)],
      tags: ['from-vision'],
      value: lengthPx(px) as RadiusToken['value'],
    };
    tokens.push(token);
  }

  // ----- Shadows -----
  let shadowIndex = 0;
  for (const entry of report.shadows) {
    const layers = entry.layers.map(shadowLayerFromEntry);
    if (layers.length === 0) continue;
    const token: ShadowToken = {
      id: stableId(
        'shadow',
        JSON.stringify({
          layers: entry.layers.map((l) => `${l.offsetX},${l.offsetY},${l.blur},${l.spread},${l.color},${l.alpha},${l.inset}`).join('|'),
        }),
      ),
      category: 'shadow',
      name: `shadow-${++shadowIndex}`,
      confidence: entry.confidence,
      usageCount: 1,
      evidence: [visionEvidence(entry.description, options.pageNumber)],
      tags: ['from-vision', `target:${entry.target}`],
      value: { target: 'box-shadow', layers },
    };
    tokens.push(token);
  }

  // ----- Gradients -----
  let gradientIndex = 0;
  for (const entry of report.gradients) {
    const stops = entry.stops
      .map((s) => {
        try {
          return {
            color: parseColor(s.hex),
            ...(s.position !== undefined ? { position: s.position } : {}),
          };
        } catch {
          return null;
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    if (stops.length < 2) continue;
    const token: GradientToken = {
      id: stableId(
        'gradient',
        JSON.stringify({ k: entry.kind, a: entry.angleDeg, s: stops.map((x) => x.color.hex) }),
      ),
      category: 'gradient',
      name: `gradient-${++gradientIndex}`,
      confidence: entry.confidence,
      usageCount: 1,
      evidence: [visionEvidence(entry.description ?? `${entry.kind} gradient`, options.pageNumber)],
      tags: ['from-vision'],
      value:
        entry.kind === 'radial'
          ? { kind: 'radial', shape: 'ellipse', position: 'center', stops, repeating: false }
          : entry.kind === 'conic'
            ? { kind: 'conic', fromDeg: 0, stops }
            : { kind: 'linear', angleDeg: entry.angleDeg ?? 180, stops, repeating: false },
    };
    tokens.push(token);
  }

  // ----- Components -----
  let componentIndex = 0;
  for (const entry of report.components) {
    const kind = COMPONENT_KINDS.has(entry.kind as ComponentKind) ? entry.kind : 'unknown';
    const component: Component = {
      id: stableId('component', `${kind}|${entry.bbox.x},${entry.bbox.y},${entry.bbox.width},${entry.bbox.height}`),
      kind: kind as ComponentKind,
      name: entry.variantHint ? `${kind}-${entry.variantHint}` : `${kind}-${++componentIndex}`,
      confidence: entry.confidence,
      variants: [],
      props: [],
      evidence: [
        {
          source: 'vision',
          rawText: entry.variantHint
            ? `${kind} (${entry.variantHint})`
            : `${kind}`,
          bbox: entry.bbox,
          ...(options.pageNumber ? { pageNumber: options.pageNumber } : {}),
        },
      ],
      tags: ['from-vision'],
    };
    components.push(component);
  }

  return { tokens, components, warnings };
}
