'use client';

import { use, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { CostMeter } from '@/components/cost-meter';
import { StageStepper } from '@/components/stage-stepper';
import { TokenGallery } from '@/components/token-gallery';
import { useExtractionStore } from '@/lib/extraction-store';
import { useExtractionStream } from '@/lib/sse';
import { plural, formatDuration } from '@/lib/utils';

export default function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const state = useExtractionStore();

  useEffect(() => {
    if (state.extractionId !== id) state.reset(id);
  }, [id, state]);

  useExtractionStream({
    extractionId: id,
    onDelta: (delta) => state.apply(delta),
    onError: (msg) => state.markFailed(msg),
    onDone: () => {
      // Small delay so the "final" token/cost deltas flush into the store.
      setTimeout(() => router.push(`/results/${id}`), 1200);
    },
  });

  const hasTokens = state.tokens.length > 0;
  const durationSoFar = useMemo(() => {
    const first = state.stages.find((s) => s.startedAt)?.startedAt;
    if (!first) return 0;
    return Date.now() - new Date(first).getTime();
  }, [state.stages]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <LinkIcon className="h-4 w-4 text-[var(--color-muted)]" />
          <h1 className="font-mono text-sm text-[var(--color-muted)]">{id}</h1>
        </div>
        {state.isComplete && !state.failed && (
          <Button onClick={() => router.push(`/results/${id}`)}>
            View results <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </header>

      {state.failed && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <strong>Extraction failed.</strong> {state.errorMessage}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Left rail */}
        <aside className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                Pipeline
              </h2>
            </CardHeader>
            <CardBody>
              <StageStepper stages={state.stages} />
            </CardBody>
          </Card>

          <CostMeter totalUsd={state.totalCostUsd} calls={state.modelCalls} />

          <Card>
            <CardBody>
              <dl className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-[var(--color-muted)]">Tokens</dt>
                  <dd className="font-mono text-lg tabular-nums">{state.tokens.length}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-muted)]">Warnings</dt>
                  <dd className="font-mono text-lg tabular-nums">{state.warnings.length}</dd>
                </div>
                <div>
                  <dt className="text-[var(--color-muted)]">Elapsed</dt>
                  <dd className="font-mono tabular-nums">
                    {state.summary
                      ? formatDuration(state.summary.durationMs)
                      : formatDuration(durationSoFar)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[var(--color-muted)]">Models</dt>
                  <dd className="font-mono text-xs">
                    {new Set(state.modelCalls.map((c) => c.model)).size || '—'}
                  </dd>
                </div>
              </dl>
            </CardBody>
          </Card>
        </aside>

        {/* Live gallery */}
        <section>
          {hasTokens ? (
            <Card>
              <CardHeader className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                  Live tokens
                </h2>
                <span className="text-xs text-[var(--color-muted)]">
                  {plural(state.tokens.length, 'token')} streamed
                </span>
              </CardHeader>
              <CardBody>
                <TokenGallery tokens={state.tokens} />
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardBody className="flex min-h-[320px] flex-col items-center justify-center gap-2 text-center">
                <div className="h-2 w-28 overflow-hidden rounded-full bg-[var(--color-border)]">
                  <div className="h-full w-1/3 animate-pulse rounded-full bg-[var(--color-accent)]" />
                </div>
                <p className="text-sm text-[var(--color-muted)]">
                  Tokens will appear here as they&apos;re extracted.
                </p>
              </CardBody>
            </Card>
          )}
        </section>
      </div>
    </main>
  );
}
