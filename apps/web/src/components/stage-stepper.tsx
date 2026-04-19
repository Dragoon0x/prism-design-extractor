'use client';

import { Check, Loader2, SkipForward, TriangleAlert } from 'lucide-react';
import type { ExtractionStage } from '@prism/shared';
import { cn } from '@/lib/utils';
import type { StageRecord } from '@/lib/extraction-store';

const STAGE_ORDER: ExtractionStage[] = [
  'queued',
  'validating',
  'browser-launching',
  'page-loading',
  'viewport-capture',
  'computed-styles',
  'state-sampling',
  'axe-audit',
  'pdf-splitting',
  'page-rendering',
  'image-preprocessing',
  'vision-call',
  'ocr',
  'fusion',
  'clustering',
  'confidence-scoring',
  'intelligence-naming',
  'intelligence-audits',
  'output-generation',
  'persistence',
  'done',
];

const LABELS: Record<ExtractionStage, string> = {
  queued: 'Queued',
  validating: 'Validating input',
  'browser-launching': 'Launching browser',
  'page-loading': 'Loading page',
  'viewport-capture': 'Capturing viewports',
  'computed-styles': 'Computed styles',
  'state-sampling': 'State sampling',
  'axe-audit': 'Accessibility audit',
  'pdf-splitting': 'Splitting PDF',
  'page-rendering': 'Rendering pages',
  'image-preprocessing': 'Preprocessing image',
  'vision-call': 'Vision analysis',
  ocr: 'OCR',
  fusion: 'Fusion',
  clustering: 'Clustering tokens',
  'confidence-scoring': 'Confidence scoring',
  'intelligence-naming': 'Semantic naming',
  'intelligence-audits': 'Audits',
  'output-generation': 'Generating outputs',
  persistence: 'Persisting',
  done: 'Done',
  failed: 'Failed',
};

export function StageStepper({ stages }: { stages: StageRecord[] }) {
  // Only render stages that have been seen OR that appear in the canonical URL ordering and have been implied.
  const seen = new Map(stages.map((s) => [s.stage, s]));
  const ordered = STAGE_ORDER.filter((s) => seen.has(s)).map((s) => seen.get(s)!);
  if (seen.has('failed')) ordered.push(seen.get('failed')!);

  if (ordered.length === 0) {
    return (
      <ol className="space-y-2 text-sm text-[var(--color-muted)]">
        <li className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Waiting for the worker…
        </li>
      </ol>
    );
  }

  return (
    <ol className="space-y-2 text-sm">
      {ordered.map((stage) => (
        <li key={stage.stage} className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">
            <StatusIcon status={stage.status} />
          </div>
          <div className="min-w-0 flex-1">
            <div
              className={cn(
                'flex items-center justify-between gap-2 font-medium',
                stage.status === 'failed' && 'text-rose-600',
                stage.status === 'skipped' && 'text-[var(--color-muted)]',
              )}
            >
              <span>{LABELS[stage.stage] ?? stage.stage}</span>
              {stage.status === 'started' && stage.progress !== undefined && (
                <span className="text-xs font-normal text-[var(--color-muted)]">
                  {Math.round(stage.progress * 100)}%
                </span>
              )}
            </div>
            {stage.message && (
              <p className="truncate text-xs text-[var(--color-muted)]">{stage.message}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function StatusIcon({ status }: { status: StageRecord['status'] }) {
  switch (status) {
    case 'succeeded':
      return (
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Check className="h-3 w-3" />
        </div>
      );
    case 'failed':
      return (
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-rose-700">
          <TriangleAlert className="h-3 w-3" />
        </div>
      );
    case 'skipped':
      return (
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-surface)] text-[var(--color-muted)]">
          <SkipForward className="h-3 w-3" />
        </div>
      );
    case 'started':
    case 'progress':
      return (
        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-surface)] text-[var(--color-accent)]">
          <Loader2 className="h-3 w-3 animate-spin" />
        </div>
      );
    default:
      return <div className="h-5 w-5 rounded-full bg-[var(--color-border)]" />;
  }
}
