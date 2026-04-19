/**
 * DESIGN.md extended — the full-fat variant with evidence per token, audits,
 * components, asset catalog, cost breakdown, and warnings.
 *
 * Target: fits in a 200K-token Claude context, but is richer than the compact.
 * Optimized for human reading as much as agent consumption.
 */
import type {
  Artifact,
  CanonicalExtraction,
  EvidenceItem,
  Token,
} from '@prism/shared';
import { textArtifact } from './../artifact.js';
import {
  colorCss,
  keyedTokens,
  lengthCss,
  radiusCss,
  shadowCss,
  tokensByCategory,
  typographyCss,
} from './../shared.js';

function evidenceLine(e: EvidenceItem): string {
  const pieces: string[] = [`[${e.source}]`];
  if (e.viewport) pieces.push(e.viewport);
  if (e.pageNumber) pieces.push(`p.${e.pageNumber}`);
  if (e.selector) pieces.push(`\`${e.selector}\``);
  if (e.elementState && e.elementState !== 'default') pieces.push(`:${e.elementState}`);
  if (e.rawText) pieces.push(`→ \`${e.rawText.slice(0, 80)}\``);
  return pieces.join(' ');
}

function tokenSection(heading: string, tokens: Token[], render: (t: Token) => string[]): string[] {
  if (tokens.length === 0) return [];
  const lines: string[] = [`## ${heading} (${tokens.length})`, ''];
  for (const { key, value } of keyedTokens(tokens)) {
    lines.push(`### \`${key}\`  ·  confidence ${value.confidence.toFixed(2)}  ·  ${value.usageCount}×`);
    lines.push('');
    for (const line of render(value)) lines.push(line);
    if (value.evidence.length > 0) {
      lines.push('');
      lines.push(`_Evidence (${value.evidence.length}):_`);
      for (const e of value.evidence.slice(0, 8)) lines.push(`- ${evidenceLine(e)}`);
    }
    lines.push('');
  }
  return lines;
}

export function generateDesignMdExtended(extraction: CanonicalExtraction): Artifact {
  const t = tokensByCategory(extraction);
  const lines: string[] = [];

  // Header
  lines.push(`# Design System (extended)`);
  lines.push('');
  const inputDesc =
    extraction.input.type === 'url' ? extraction.input.url : `${extraction.input.type} upload`;
  lines.push(`**Source:** \`${inputDesc}\``);
  lines.push(`**Extraction:** \`${extraction.extractionId}\``);
  lines.push(`**Schema:** v${extraction.schemaVersion}`);
  lines.push(`**Extracted:** ${extraction.meta.extractedAt}`);
  lines.push(`**Duration:** ${(extraction.meta.durationMs / 1000).toFixed(1)}s`);
  lines.push('');

  // Run summary
  lines.push(`## Run summary`);
  lines.push('');
  lines.push(`- **Tokens:** ${extraction.tokens.length}`);
  lines.push(`- **Components:** ${extraction.components.length}`);
  lines.push(`- **Assets:** ${extraction.assets.length}`);
  lines.push(`- **Audits:** ${extraction.audits.length}`);
  lines.push(`- **Warnings:** ${extraction.warnings.length}`);
  lines.push(
    `- **Models:** ${extraction.meta.modelsUsed.length > 0 ? extraction.meta.modelsUsed.join(', ') : '(none recorded)'}`,
  );
  lines.push(`- **Cost:** $${extraction.meta.cost.totalUsd.toFixed(4)} (in: ${extraction.meta.cost.inputTokens}, out: ${extraction.meta.cost.outputTokens}, cache-read: ${extraction.meta.cost.cacheReadTokens})`);
  lines.push('');

  // Colors
  lines.push(
    ...tokenSection('Colors', t.colors, (tok) => {
      const c = tok as typeof t.colors[number];
      return [
        `- **Hex:** \`${colorCss(c.value)}\``,
        `- **RGB:** \`rgb(${c.value.rgb.r}, ${c.value.rgb.g}, ${c.value.rgb.b})\``,
        `- **HSL:** \`hsl(${c.value.hsl.h}, ${c.value.hsl.s}%, ${c.value.hsl.l}%)\``,
        `- **OKLCH:** \`oklch(${c.value.oklch.l} ${c.value.oklch.c} ${c.value.oklch.h})\``,
      ];
    }),
  );

  // Typography
  lines.push(
    ...tokenSection('Typography', t.typography, (tok) => {
      const v = typographyCss(tok as typeof t.typography[number]);
      return [
        `- **Family:** ${v.family}`,
        `- **Size:** ${v.size}`,
        `- **Weight:** ${v.weight}`,
        v.lineHeight !== undefined ? `- **Line height:** ${v.lineHeight}` : '',
        v.letterSpacing !== undefined ? `- **Letter spacing:** ${v.letterSpacing}` : '',
      ].filter(Boolean);
    }),
  );

  // Spacing
  lines.push(
    ...tokenSection('Spacing', t.spacing, (tok) => {
      const s = tok as typeof t.spacing[number];
      const out: string[] = [`- **Value:** ${lengthCss(s.value)}`];
      if (s.scaleBasePx !== undefined) out.push(`- **Scale base:** ${s.scaleBasePx}px`);
      if (s.scaleMultiple !== undefined) out.push(`- **Multiple:** ${s.scaleMultiple}×`);
      out.push(`- **Role:** ${s.spacingRole}`);
      return out;
    }),
  );

  // Radii / Shadows
  lines.push(
    ...tokenSection('Radii', t.radii, (tok) => [
      `- **Value:** ${radiusCss(tok as typeof t.radii[number])}`,
    ]),
  );
  lines.push(
    ...tokenSection('Shadows', t.shadows, (tok) => [
      `- **Value:** \`${shadowCss(tok as typeof t.shadows[number])}\``,
    ]),
  );

  // Components (placeholder until Phase 8)
  if (extraction.components.length > 0) {
    lines.push(`## Components (${extraction.components.length})`);
    lines.push('');
    for (const c of extraction.components) {
      lines.push(
        `- **${c.name}** (${c.kind}) — confidence ${c.confidence.toFixed(2)}${c.variants.length > 0 ? `, ${c.variants.length} variants` : ''}`,
      );
    }
    lines.push('');
  }

  // Audits
  if (extraction.audits.length > 0) {
    lines.push(`## Audits (${extraction.audits.length})`);
    lines.push('');
    for (const a of extraction.audits) {
      lines.push(`- **[${a.severity}]** _${a.kind}_ — ${a.message}`);
    }
    lines.push('');
  }

  // Warnings
  if (extraction.warnings.length > 0) {
    lines.push(`## Warnings (${extraction.warnings.length})`);
    lines.push('');
    for (const w of extraction.warnings) {
      lines.push(`- **[${w.severity}]** _${w.stage}_ — ${w.message}`);
    }
    lines.push('');
  }

  // Cost breakdown
  if (extraction.meta.cost.calls.length > 0) {
    lines.push(`## Model calls (${extraction.meta.cost.calls.length})`);
    lines.push('');
    for (const call of extraction.meta.cost.calls) {
      lines.push(
        `- \`${call.stage}\` → **${call.model}** · in=${call.inputTokens} out=${call.outputTokens} cache-read=${call.cacheReadTokens} · $${call.costUsd.toFixed(5)} · ${call.durationMs}ms`,
      );
    }
    lines.push('');
  }

  lines.push(`---`);
  lines.push(`_Generated by [Prism](https://github.com/REPLACE_ME/prism)_`);
  lines.push('');

  return textArtifact({
    format: 'design-md-extended',
    filename: 'DESIGN.extended.md',
    contentType: 'text/markdown',
    text: lines.join('\n'),
  });
}
