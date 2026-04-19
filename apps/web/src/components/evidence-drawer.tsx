'use client';

import type { Token } from '@prism/shared';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function EvidenceDrawer({
  token,
  onClose,
}: {
  token: Token | null;
  onClose: () => void;
}) {
  const open = token !== null;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent side="right" className="p-0">
        {token && (
          <div className="flex h-full flex-col">
            <DialogHeader className="border-b border-[var(--color-border)] p-6 pb-4">
              <div className="flex items-center gap-2">
                <Badge tone="accent">{token.category}</Badge>
                <Badge tone="neutral">
                  conf {token.confidence.toFixed(2)}
                </Badge>
                <Badge tone="neutral">{token.usageCount}×</Badge>
              </div>
              <DialogTitle>{token.semanticRole ?? token.name}</DialogTitle>
              <DialogDescription className="font-mono">{token.id}</DialogDescription>
            </DialogHeader>

            <div className="flex-1 space-y-6 overflow-y-auto p-6">
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                  Value
                </h3>
                <pre className="overflow-x-auto rounded-lg bg-[var(--color-surface)] p-3 font-mono text-xs">
                  {JSON.stringify('value' in token ? token.value : token, null, 2)}
                </pre>
              </section>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                  Evidence ({token.evidence.length})
                </h3>
                <ul className="space-y-3">
                  {token.evidence.map((e, i) => (
                    <li
                      key={i}
                      className={cn(
                        'rounded-lg border border-[var(--color-border)] bg-white p-3 text-sm',
                      )}
                    >
                      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                        <Badge tone="neutral">{e.source}</Badge>
                        {e.viewport && <Badge tone="neutral">{e.viewport}</Badge>}
                        {e.pageNumber && <Badge tone="neutral">p.{e.pageNumber}</Badge>}
                        {e.elementState && e.elementState !== 'default' && (
                          <Badge tone="accent">:{e.elementState}</Badge>
                        )}
                      </div>
                      {e.selector && (
                        <div className="mb-1 truncate font-mono text-xs text-[var(--color-muted)]">
                          {e.selector}
                        </div>
                      )}
                      {e.rawText && (
                        <div className="break-words font-mono text-xs">{e.rawText}</div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>

              {token.tags.length > 0 && (
                <section>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {token.tags.map((t) => (
                      <Badge key={t} tone="neutral">
                        {t}
                      </Badge>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
