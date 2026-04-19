'use client';

import { DollarSign } from 'lucide-react';
import type { ModelCall } from '@prism/shared';
import { formatUsd } from '@/lib/utils';

export function CostMeter({
  totalUsd,
  calls,
}: {
  totalUsd: number;
  calls: ModelCall[];
}) {
  const inputTokens = calls.reduce((sum, c) => sum + c.inputTokens, 0);
  const outputTokens = calls.reduce((sum, c) => sum + c.outputTokens, 0);
  const cacheRead = calls.reduce((sum, c) => sum + c.cacheReadTokens, 0);

  return (
    <div className="flex flex-col gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-muted)]">
          <DollarSign className="h-3.5 w-3.5" />
          API cost
        </span>
        <span className="font-mono text-2xl font-semibold tabular-nums">
          {formatUsd(totalUsd)}
        </span>
      </div>
      <div className="mt-1 grid grid-cols-3 gap-2 text-[11px] text-[var(--color-muted)]">
        <div>
          <div className="font-mono tabular-nums">{inputTokens.toLocaleString()}</div>
          <div>in</div>
        </div>
        <div>
          <div className="font-mono tabular-nums">{outputTokens.toLocaleString()}</div>
          <div>out</div>
        </div>
        <div>
          <div className="font-mono tabular-nums">{cacheRead.toLocaleString()}</div>
          <div>cache-read</div>
        </div>
      </div>
    </div>
  );
}
