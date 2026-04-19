/**
 * W3C Design Token Community Group (DTCG) serialization.
 *
 * Spec: https://www.designtokens.org/tr/drafts/format/
 * Shape we emit:
 *   {
 *     "color": { "primary": { "$type": "color", "$value": "#3b82f6" } },
 *     "spacing": { "md": { "$type": "dimension", "$value": "16px" } },
 *     "typography": { "heading-lg": { "$type": "typography", "$value": {…} } },
 *     ...
 *   }
 *
 * Every token's *name* becomes the leaf key. Semantic role (if the intelligence
 * layer has assigned one) takes precedence over the machine name so that
 * `color.primary` is preferred over `color.color-1`.
 *
 * The DTCG tree is deliberately a plain JSON object — every output generator
 * (Tailwind / CSS / Style Dictionary / Figma Tokens) can read from it directly.
 */
import type {
  BorderToken,
  CanonicalExtraction,
  ColorToken,
  GradientToken,
  MotionToken,
  OpacityToken,
  RadiusToken,
  ShadowToken,
  SpacingToken,
  Token,
  TypographyToken,
} from '@prism/shared';

export interface DtcgToken {
  $type: string;
  $value: unknown;
  $description?: string;
  /** Non-standard extension: we carry confidence + usage through so generators can filter. */
  $extensions?: {
    'com.prism.confidence'?: number;
    'com.prism.usageCount'?: number;
    'com.prism.sourceId'?: string;
  };
}

export interface DtcgTree {
  [category: string]: { [name: string]: DtcgToken } | undefined;
}

function leafKey(token: Token, fallbackIndex: number): string {
  if (token.semanticRole && token.semanticRole.length > 0) return toKebab(token.semanticRole);
  if (token.name && token.name.length > 0) return toKebab(token.name);
  return `${token.category}-${fallbackIndex + 1}`;
}

function toKebab(s: string): string {
  return s
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function dim(px: number | undefined, unit: string, value: number): string {
  if (unit === 'px' && px !== undefined) return `${px}px`;
  return `${value}${unit}`;
}

function serializeColor(t: ColorToken): DtcgToken {
  const { hex, alpha } = t.value;
  const value = alpha === 1 ? hex : `${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
  return {
    $type: 'color',
    $value: value,
    $extensions: {
      'com.prism.confidence': t.confidence,
      'com.prism.usageCount': t.usageCount,
      'com.prism.sourceId': t.id,
    },
  };
}

function serializeSpacing(t: SpacingToken): DtcgToken {
  return {
    $type: 'dimension',
    $value: dim(t.value.px, t.value.unit, t.value.value),
    $extensions: {
      'com.prism.confidence': t.confidence,
      'com.prism.usageCount': t.usageCount,
      'com.prism.sourceId': t.id,
    },
  };
}

function serializeRadius(t: RadiusToken): DtcgToken {
  const v = t.value;
  if ('kind' in v && v.kind === 'asymmetric') {
    return {
      $type: 'dimension',
      $value: [
        dim(v.topLeft.px, v.topLeft.unit, v.topLeft.value),
        dim(v.topRight.px, v.topRight.unit, v.topRight.value),
        dim(v.bottomRight.px, v.bottomRight.unit, v.bottomRight.value),
        dim(v.bottomLeft.px, v.bottomLeft.unit, v.bottomLeft.value),
      ].join(' '),
    };
  }
  const len = v as { value: number; unit: string; px?: number };
  return {
    $type: 'dimension',
    $value: dim(len.px, len.unit, len.value),
    $extensions: {
      'com.prism.confidence': t.confidence,
      'com.prism.usageCount': t.usageCount,
      'com.prism.sourceId': t.id,
    },
  };
}

function serializeTypography(t: TypographyToken): DtcgToken {
  const v = t.value;
  const sizeStr = dim(v.size.px, v.size.unit, v.size.value);
  const letterSpacing = v.letterSpacing
    ? dim(v.letterSpacing.px, v.letterSpacing.unit, v.letterSpacing.value)
    : undefined;
  let lineHeight: string | number | undefined;
  if (v.lineHeight) {
    if (v.lineHeight.kind === 'unitless') lineHeight = v.lineHeight.value;
    else if (v.lineHeight.kind === 'length') {
      lineHeight = dim(v.lineHeight.value.px, v.lineHeight.value.unit, v.lineHeight.value.value);
    }
  }
  return {
    $type: 'typography',
    $value: {
      fontFamily: [v.family, ...v.fallbackStack].filter(Boolean),
      fontSize: sizeStr,
      fontWeight: v.weight,
      ...(lineHeight !== undefined ? { lineHeight } : {}),
      ...(letterSpacing ? { letterSpacing } : {}),
      ...(v.textTransform !== 'none' ? { textTransform: v.textTransform } : {}),
      ...(v.textDecoration !== 'none' ? { textDecoration: v.textDecoration } : {}),
      ...(v.fontStyle !== 'normal' ? { fontStyle: v.fontStyle } : {}),
    },
    $extensions: {
      'com.prism.confidence': t.confidence,
      'com.prism.usageCount': t.usageCount,
      'com.prism.sourceId': t.id,
    },
  };
}

function serializeShadow(t: ShadowToken): DtcgToken {
  const v = t.value;
  const layers = v.layers.map((layer) => ({
    offsetX: dim(layer.offsetX.px, layer.offsetX.unit, layer.offsetX.value),
    offsetY: dim(layer.offsetY.px, layer.offsetY.unit, layer.offsetY.value),
    blur: dim(layer.blur.px, layer.blur.unit, layer.blur.value),
    spread: dim(layer.spread.px, layer.spread.unit, layer.spread.value),
    color: layer.color.alpha === 1 ? layer.color.hex : `${layer.color.hex}${Math.round(layer.color.alpha * 255).toString(16).padStart(2, '0')}`,
    inset: layer.inset,
  }));
  return {
    $type: 'shadow',
    $value: layers.length === 1 ? layers[0] : layers,
    $extensions: {
      'com.prism.confidence': t.confidence,
      'com.prism.usageCount': t.usageCount,
      'com.prism.sourceId': t.id,
    },
  };
}

function serializeBorder(t: BorderToken): DtcgToken {
  return {
    $type: 'border',
    $value: {
      color: t.value.color.hex,
      width: dim(t.value.width.px, t.value.width.unit, t.value.width.value),
      style: t.value.style,
    },
  };
}

function serializeGradient(t: GradientToken): DtcgToken {
  const v = t.value;
  const stops = v.stops.map((s) => ({
    color: s.color.alpha === 1 ? s.color.hex : `${s.color.hex}${Math.round(s.color.alpha * 255).toString(16).padStart(2, '0')}`,
    ...(s.position !== undefined ? { position: s.position } : {}),
  }));
  const base =
    v.kind === 'linear'
      ? { kind: 'linear', angleDeg: v.angleDeg, stops, repeating: v.repeating }
      : v.kind === 'radial'
        ? { kind: 'radial', shape: v.shape, position: v.position, stops, repeating: v.repeating }
        : { kind: 'conic', fromDeg: v.fromDeg, stops };
  return { $type: 'gradient', $value: base };
}

function serializeMotion(t: MotionToken): DtcgToken {
  const v = t.value;
  let easingStr: string;
  switch (v.easing.kind) {
    case 'named':
      easingStr = v.easing.name;
      break;
    case 'cubic-bezier':
      easingStr = `cubic-bezier(${v.easing.p1x}, ${v.easing.p1y}, ${v.easing.p2x}, ${v.easing.p2y})`;
      break;
    case 'steps':
      easingStr = `steps(${v.easing.count}, ${v.easing.position})`;
      break;
  }
  return {
    $type: 'transition',
    $value: {
      duration: `${v.duration.ms}ms`,
      delay: `${v.delay.ms}ms`,
      timingFunction: easingStr,
      ...(v.property && v.property !== 'all' ? { property: v.property } : {}),
    },
  };
}

function serializeOpacity(t: OpacityToken): DtcgToken {
  return {
    $type: 'number',
    $value: t.value,
    $extensions: {
      'com.prism.confidence': t.confidence,
      'com.prism.usageCount': t.usageCount,
      'com.prism.sourceId': t.id,
    },
  };
}

function categoryBucket(cat: Token['category']): string {
  switch (cat) {
    case 'color':
      return 'color';
    case 'spacing':
      return 'spacing';
    case 'radius':
      return 'radius';
    case 'typography':
      return 'typography';
    case 'shadow':
      return 'shadow';
    case 'border':
      return 'border';
    case 'gradient':
      return 'gradient';
    case 'motion':
      return 'transition';
    case 'breakpoint':
      return 'breakpoint';
    case 'z-index':
      return 'zIndex';
    case 'opacity':
      return 'opacity';
    case 'filter':
      return 'filter';
  }
}

/**
 * Convert a canonical extraction's tokens into a DTCG tree.
 * Pass the full `CanonicalExtraction` (for schema metadata) or just the tokens.
 */
export function toDtcg(input: CanonicalExtraction | Token[]): DtcgTree {
  const tokens = Array.isArray(input) ? input : input.tokens;
  const tree: DtcgTree = {};
  const counters = new Map<string, number>();

  for (const token of tokens) {
    const bucket = categoryBucket(token.category);
    if (!tree[bucket]) tree[bucket] = {};
    const idx = counters.get(bucket) ?? 0;
    counters.set(bucket, idx + 1);
    const key = leafKey(token, idx);

    let serialized: DtcgToken;
    switch (token.category) {
      case 'color':
        serialized = serializeColor(token);
        break;
      case 'spacing':
        serialized = serializeSpacing(token);
        break;
      case 'radius':
        serialized = serializeRadius(token);
        break;
      case 'typography':
        serialized = serializeTypography(token);
        break;
      case 'shadow':
        serialized = serializeShadow(token);
        break;
      case 'border':
        serialized = serializeBorder(token);
        break;
      case 'gradient':
        serialized = serializeGradient(token);
        break;
      case 'motion':
        serialized = serializeMotion(token);
        break;
      case 'opacity':
        serialized = serializeOpacity(token);
        break;
      case 'breakpoint':
        serialized = {
          $type: 'dimension',
          $value: dim(token.value.px, token.value.unit, token.value.value),
        };
        break;
      case 'z-index':
        serialized = { $type: 'number', $value: token.value };
        break;
      case 'filter':
        serialized = { $type: 'string', $value: '(filter)' };
        break;
      default:
        continue;
    }
    tree[bucket]![dedupeKey(tree[bucket]!, key)] = serialized;
  }

  return tree;
}

function dedupeKey(group: { [k: string]: DtcgToken }, key: string): string {
  if (!(key in group)) return key;
  let i = 2;
  while (`${key}-${i}` in group) i++;
  return `${key}-${i}`;
}
