/**
 * Axe-core accessibility audit per viewport.
 * Violations map into `Audit` entries on the canonical extraction.
 */
import AxeBuilder from '@axe-core/playwright';
import type { Page } from 'playwright-core';

export interface AxeViolation {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical' | null;
  description: string;
  help: string;
  helpUrl: string;
  nodes: {
    html: string;
    target: string[];
    failureSummary: string | undefined;
  }[];
}

export interface AxeReport {
  violations: AxeViolation[];
  incomplete: AxeViolation[];
  passCount: number;
  inapplicableCount: number;
}

/** Run axe-core against the current page. Safe to call after each viewport set. */
export async function runAxe(page: Page): Promise<AxeReport> {
  const results = await new AxeBuilder({ page }).analyze();
  // axe-core's Result shape is richer than what we persist; narrow via `unknown`
  // to avoid coupling to its frame-selector union types.
  const mapViolation = (raw: unknown): AxeViolation => {
    const v = raw as {
      id: string;
      impact?: string | null;
      description: string;
      help: string;
      helpUrl: string;
      nodes: { html: string; target: unknown; failureSummary?: string }[];
    };
    return {
      id: v.id,
      impact: (v.impact as AxeViolation['impact']) ?? null,
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      nodes: v.nodes.map((n) => ({
        html: n.html,
        target: (Array.isArray(n.target) ? n.target : []).map((t) => String(t)),
        failureSummary: n.failureSummary,
      })),
    };
  };
  return {
    violations: results.violations.map(mapViolation),
    incomplete: results.incomplete.map(mapViolation),
    passCount: results.passes.length,
    inapplicableCount: results.inapplicable.length,
  };
}
