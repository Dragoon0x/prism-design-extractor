/**
 * Consistency + contrast + debt audits.
 *
 * Every audit here is deterministic (no LLM). Audits emit `Audit` records
 * that land on the canonical extraction for the `audits` tab in the UI + the
 * DESIGN.md extended output.
 *
 * Kinds we emit:
 *   - `contrast` — WCAG contrast failures between plausible foreground × background pairs.
 *   - `duplication` — ΔE < 1.0 color pairs that somehow survived clustering.
 *   - `magic-value` — spacing tokens that don't fit the detected scale.
 *   - `inconsistent-radius` — more than 6 distinct radius tokens.
 *   - `inconsistent-spacing` — off-scale spacing values outnumber on-scale ones.
 *   - `missing-semantic-name` — tokens with confidence ≥ 0.8 but no semanticRole.
 *   - `orphan` / `unused-token` — confidence < 0.4 or usageCount === 0.
 */
import { createHash } from 'node:crypto';
import type {
  Audit,
  AuditKind,
  AuditSeverity,
  CanonicalExtraction,
  ColorToken,
  SpacingToken,
  Token,
} from '@prism/shared';
import { contrastRatio, deltaE, parseColor } from '@prism/tokens';

function auditId(seed: string): string {
  return `audit:${createHash('sha256').update(seed).digest('hex').slice(0, 16)}`;
}

function mkAudit(params: {
  kind: AuditKind;
  severity: AuditSeverity;
  message: string;
  refs?: { entityType: 'token' | 'component' | 'asset'; entityId: string }[];
  suggestion?: Audit['suggestion'];
}): Audit {
  return {
    id: auditId(`${params.kind}:${params.message}`),
    kind: params.kind,
    severity: params.severity,
    message: params.message,
    references: params.refs ?? [],
    ...(params.suggestion ? { suggestion: params.suggestion } : {}),
    evidence: [],
  };
}

// ---------------------------------------------------------------------------
// Contrast
// ---------------------------------------------------------------------------

const FG_ROLES = new Set(['foreground', 'muted-foreground', 'primary', 'destructive', 'success', 'warning', 'info', 'accent', 'secondary']);
const BG_ROLES = new Set(['background', 'surface', 'surface-subtle']);

export function auditContrast(extraction: CanonicalExtraction): Audit[] {
  const colors = extraction.tokens.filter((t): t is ColorToken => t.category === 'color');
  const fgs = colors.filter((c) => c.semanticRole && FG_ROLES.has(c.semanticRole));
  const bgs = colors.filter((c) => c.semanticRole && BG_ROLES.has(c.semanticRole));

  const audits: Audit[] = [];

  // If we have named foreground/background pairs, grade them directly.
  for (const fg of fgs) {
    for (const bg of bgs) {
      const ratio = contrastRatio(parseColor(fg.value.hex), parseColor(bg.value.hex));
      const passesAA_normal = ratio >= 4.5;
      const passesAA_large = ratio >= 3;
      if (!passesAA_normal) {
        audits.push(
          mkAudit({
            kind: 'contrast',
            severity: passesAA_large ? 'minor' : 'major',
            message: `${fg.semanticRole} on ${bg.semanticRole}: ${ratio.toFixed(2)}:1 — fails WCAG AA for normal text (4.5:1).`,
            refs: [
              { entityType: 'token', entityId: fg.id },
              { entityType: 'token', entityId: bg.id },
            ],
            suggestion: {
              kind: 'fix-contrast',
              detail: {
                targetFgTokenId: fg.id,
                targetBgTokenId: bg.id,
                requiredRatio: 4.5,
                currentRatio: ratio,
              },
            },
          }),
        );
      }
    }
  }

  // If no named bg/fg exist yet, fall back to pairing the darkest with the lightest.
  if (audits.length === 0 && colors.length >= 2) {
    const byLum = [...colors]
      .map((c) => ({ c, lum: (c.value.hsl.l) }))
      .sort((a, b) => a.lum - b.lum);
    const dark = byLum[0]!.c;
    const light = byLum[byLum.length - 1]!.c;
    const ratio = contrastRatio(parseColor(dark.value.hex), parseColor(light.value.hex));
    if (ratio < 4.5) {
      audits.push(
        mkAudit({
          kind: 'contrast',
          severity: 'minor',
          message: `darkest/lightest pair has low contrast (${ratio.toFixed(2)}:1). Consider a higher-contrast primary foreground.`,
          refs: [
            { entityType: 'token', entityId: dark.id },
            { entityType: 'token', entityId: light.id },
          ],
        }),
      );
    }
  }

  return audits;
}

// ---------------------------------------------------------------------------
// Near-duplicate colors
// ---------------------------------------------------------------------------

export function auditColorDuplicates(extraction: CanonicalExtraction): Audit[] {
  const colors = extraction.tokens.filter((t): t is ColorToken => t.category === 'color');
  const audits: Audit[] = [];
  for (let i = 0; i < colors.length; i++) {
    const a = colors[i]!;
    for (let j = i + 1; j < colors.length; j++) {
      const b = colors[j]!;
      if (a.value.alpha !== b.value.alpha) continue;
      const d = deltaE(a.value, b.value);
      if (d < 1.0) {
        audits.push(
          mkAudit({
            kind: 'duplication',
            severity: 'minor',
            message: `${a.name} (${a.value.hex}) and ${b.name} (${b.value.hex}) are perceptually identical (ΔE ${d.toFixed(2)}). Consider consolidating.`,
            refs: [
              { entityType: 'token', entityId: a.id },
              { entityType: 'token', entityId: b.id },
            ],
            suggestion: {
              kind: 'collapse-tokens',
              detail: { keep: a.id, drop: b.id },
            },
          }),
        );
      }
    }
  }
  return audits;
}

// ---------------------------------------------------------------------------
// Magic-value spacing
// ---------------------------------------------------------------------------

export function auditSpacing(extraction: CanonicalExtraction): Audit[] {
  const spacings = extraction.tokens.filter(
    (t): t is SpacingToken => t.category === 'spacing',
  );
  if (spacings.length === 0) return [];

  const adHoc = spacings.filter((s) => s.spacingRole === 'ad-hoc');
  const onScale = spacings.filter((s) => s.spacingRole === 'scale-step');
  const audits: Audit[] = [];

  if (adHoc.length > 0 && onScale.length > 0) {
    // Only emit per-token magic-value audits for the top few offenders.
    const topOffenders = [...adHoc].sort((a, b) => b.usageCount - a.usageCount).slice(0, 5);
    for (const t of topOffenders) {
      const base = onScale[0]?.scaleBasePx;
      const px = t.value.px ?? t.value.value;
      if (base) {
        audits.push(
          mkAudit({
            kind: 'magic-value',
            severity: 'minor',
            message: `spacing "${t.name}" (${px}px) doesn't fit the detected ${base}px scale.`,
            refs: [{ entityType: 'token', entityId: t.id }],
          }),
        );
      }
    }
  }

  if (adHoc.length > onScale.length && spacings.length >= 6) {
    audits.push(
      mkAudit({
        kind: 'inconsistent-spacing',
        severity: 'major',
        message: `${adHoc.length}/${spacings.length} spacing values are ad-hoc. The design lacks a clear scale.`,
      }),
    );
  }
  return audits;
}

// ---------------------------------------------------------------------------
// Inconsistent radii
// ---------------------------------------------------------------------------

export function auditRadii(extraction: CanonicalExtraction): Audit[] {
  const radii = extraction.tokens.filter((t) => t.category === 'radius');
  if (radii.length > 6) {
    return [
      mkAudit({
        kind: 'inconsistent-radius',
        severity: 'minor',
        message: `${radii.length} distinct radius values detected. Most design systems use 2-5.`,
      }),
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Missing semantic name
// ---------------------------------------------------------------------------

export function auditMissingNames(extraction: CanonicalExtraction): Audit[] {
  const audits: Audit[] = [];
  for (const token of extraction.tokens) {
    if (token.category !== 'color' && token.category !== 'typography') continue;
    if (token.semanticRole) continue;
    if (token.confidence < 0.8) continue;
    if (token.usageCount < 5) continue;
    audits.push(
      mkAudit({
        kind: 'missing-semantic-name',
        severity: 'info',
        message: `"${token.name}" is high-confidence (${token.confidence.toFixed(2)}) and frequently used (${token.usageCount}×) but has no semantic role.`,
        refs: [{ entityType: 'token', entityId: token.id }],
      }),
    );
  }
  return audits;
}

// ---------------------------------------------------------------------------
// Orphan / unused
// ---------------------------------------------------------------------------

export function auditOrphans(extraction: CanonicalExtraction): Audit[] {
  const audits: Audit[] = [];
  for (const token of extraction.tokens) {
    if (token.usageCount === 0) {
      audits.push(
        mkAudit({
          kind: 'unused-token',
          severity: 'info',
          message: `"${token.name}" is never used on the page; it may be dead.`,
          refs: [{ entityType: 'token', entityId: token.id }],
        }),
      );
    } else if (token.confidence < 0.4) {
      audits.push(
        mkAudit({
          kind: 'orphan',
          severity: 'info',
          message: `"${token.name}" has low confidence (${token.confidence.toFixed(2)}); may be vision noise.`,
          refs: [{ entityType: 'token', entityId: token.id }],
        }),
      );
    }
  }
  return audits;
}

/** Run every audit. Returns the merged list; caller appends to canonical.audits. */
export function runAllAudits(extraction: CanonicalExtraction): Audit[] {
  return [
    ...auditContrast(extraction),
    ...auditColorDuplicates(extraction),
    ...auditSpacing(extraction),
    ...auditRadii(extraction),
    ...auditMissingNames(extraction),
    ...auditOrphans(extraction),
  ];
}

/**
 * Summary stats for a set of audits — rendered on the `Audits` tab as a
 * compact header above the list.
 */
export function summarizeAudits(audits: Audit[]): Record<AuditSeverity, number> {
  return audits.reduce(
    (acc, a) => ({ ...acc, [a.severity]: acc[a.severity] + 1 }),
    { info: 0, minor: 0, major: 0, critical: 0 } as Record<AuditSeverity, number>,
  );
}

// Keep a referenced symbol so strict-mode-built output isn't flagged — `Token`
// is used in the function signatures above via `extraction.tokens`.
export type { Token };
