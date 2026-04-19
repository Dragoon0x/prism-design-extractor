'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import type { CanonicalExtraction } from '@prism/shared';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ShareButton } from '@/components/share-button';
import { TokenGallery } from '@/components/token-gallery';
import { OutputPanel, type ArtifactRecord } from '@/components/output-panel';
import { cn, formatDuration, formatUsd, plural } from '@/lib/utils';

type Tab = 'tokens' | 'outputs' | 'audits' | 'details';

export function ResultsView({
  id,
  status,
  inputRef,
  canonical,
  artifacts,
  error,
  readOnly = false,
  shareToken,
}: {
  id: string;
  status: string;
  inputRef: string;
  canonical: CanonicalExtraction | null;
  artifacts: ArtifactRecord[];
  error: string | null;
  readOnly?: boolean;
  shareToken?: string;
}) {
  const [tab, setTab] = useState<Tab>('tokens');

  const statusTone =
    status === 'succeeded'
      ? 'success'
      : status === 'failed'
        ? 'danger'
        : status === 'running'
          ? 'accent'
          : 'neutral';

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {!readOnly ? (
            <Link
              href="/"
              className="mb-2 inline-flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
            >
              <ArrowLeft className="h-3 w-3" /> New extraction
            </Link>
          ) : (
            <span className="mb-2 inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-widest text-[var(--color-muted)]">
              shared · read-only
            </span>
          )}
          <h1 className="flex items-center gap-2 truncate text-2xl font-semibold tracking-tight">
            <span className="truncate font-mono">{inputRef}</span>
            {inputRef.startsWith('http') && (
              <a
                href={inputRef}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-muted)] hover:text-[var(--color-fg)]"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </h1>
          {!readOnly && (
            <p className="mt-1 font-mono text-xs text-[var(--color-muted)]">{id}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={statusTone}>{status}</Badge>
          {canonical && (
            <>
              <Stat label="Tokens" value={canonical.tokens.length} />
              <Stat label="Cost" value={formatUsd(canonical.meta.cost.totalUsd)} />
              <Stat label="Duration" value={formatDuration(canonical.meta.durationMs)} />
            </>
          )}
          {!readOnly && canonical && status === 'succeeded' && (
            <ShareButton extractionId={id} />
          )}
          {readOnly && shareToken && (
            <Badge tone="neutral">share · {shareToken.slice(0, 6)}…</Badge>
          )}
        </div>
      </header>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <strong>Extraction failed.</strong> {error}
        </div>
      )}

      {!canonical ? (
        <Card>
          <CardBody className="py-12 text-center text-sm text-[var(--color-muted)]">
            {status === 'queued' || status === 'running'
              ? 'This extraction is still running. Check back in a moment, or watch live.'
              : 'No canonical tree available yet.'}
          </CardBody>
        </Card>
      ) : (
        <>
          <nav className="flex gap-1 overflow-x-auto border-b border-[var(--color-border)]">
            <TabButton active={tab === 'tokens'} onClick={() => setTab('tokens')}>
              Tokens <CountHint>{canonical.tokens.length}</CountHint>
            </TabButton>
            <TabButton active={tab === 'outputs'} onClick={() => setTab('outputs')}>
              Outputs <CountHint>{artifacts.length}</CountHint>
            </TabButton>
            <TabButton active={tab === 'audits'} onClick={() => setTab('audits')}>
              Audits <CountHint>{canonical.audits.length}</CountHint>
            </TabButton>
            <TabButton active={tab === 'details'} onClick={() => setTab('details')}>
              Details
            </TabButton>
          </nav>

          {tab === 'tokens' && (
            <Card>
              <CardBody>
                <TokenGallery tokens={canonical.tokens} />
              </CardBody>
            </Card>
          )}

          {tab === 'outputs' && (
            <Card>
              <CardBody>
                <OutputPanel artifacts={artifacts} />
              </CardBody>
            </Card>
          )}

          {tab === 'audits' && (
            <Card>
              <CardBody>
                {canonical.audits.length === 0 ? (
                  <p className="text-sm text-[var(--color-muted)]">
                    No audits yet. The consistency + a11y audit pass lands in Phase 8.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {canonical.audits.map((a) => (
                      <li
                        key={a.id}
                        className="rounded-lg border border-[var(--color-border)] bg-white p-3 text-sm"
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <Badge tone={a.severity === 'critical' ? 'danger' : a.severity === 'major' ? 'warn' : 'neutral'}>
                            {a.severity}
                          </Badge>
                          <Badge tone="neutral">{a.kind}</Badge>
                        </div>
                        <p>{a.message}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          )}

          {tab === 'details' && (
            <Card>
              <CardHeader>
                <h2 className="text-sm font-semibold">Run details</h2>
              </CardHeader>
              <CardBody>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <DetailRow label="Source">{inputRef}</DetailRow>
                  <DetailRow label="Schema">v{canonical.schemaVersion}</DetailRow>
                  <DetailRow label="Extracted at">{canonical.meta.extractedAt}</DetailRow>
                  <DetailRow label="Models">
                    {canonical.meta.modelsUsed.join(', ') || '—'}
                  </DetailRow>
                  <DetailRow label="Tokens (in / out / cache-read)">
                    {canonical.meta.cost.inputTokens.toLocaleString()} /{' '}
                    {canonical.meta.cost.outputTokens.toLocaleString()} /{' '}
                    {canonical.meta.cost.cacheReadTokens.toLocaleString()}
                  </DetailRow>
                  <DetailRow label="Warnings">
                    {plural(canonical.warnings.length, 'warning')}
                  </DetailRow>
                </dl>
                {canonical.warnings.length > 0 && (
                  <ul className="mt-4 space-y-1.5 text-xs">
                    {canonical.warnings.map((w, i) => (
                      <li key={i} className="text-[var(--color-muted)]">
                        <span className="font-mono">[{w.severity}]</span>{' '}
                        <span className="font-mono">{w.stage}</span> — {w.message}
                      </li>
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          )}
        </>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-right">
      <div className="text-[10px] uppercase tracking-widest text-[var(--color-muted)]">
        {label}
      </div>
      <div className="font-mono text-sm tabular-nums">{value}</div>
    </div>
  );
}

function TabButton({
  active,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        'relative flex items-center gap-1.5 px-3 py-2 text-sm transition',
        active
          ? 'text-[var(--color-fg)] after:absolute after:bottom-[-1px] after:left-2 after:right-2 after:h-0.5 after:bg-[var(--color-accent)]'
          : 'text-[var(--color-muted)] hover:text-[var(--color-fg)]',
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function CountHint({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs text-[var(--color-muted)]">{children}</span>;
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs uppercase tracking-widest text-[var(--color-muted)]">{label}</dt>
      <dd className="font-mono text-sm">{children}</dd>
    </div>
  );
}
