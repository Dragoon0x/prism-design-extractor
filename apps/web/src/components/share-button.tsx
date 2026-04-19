'use client';

import { useState } from 'react';
import { Check, Copy, Link2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function ShareButton({ extractionId }: { extractionId: string }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [exposeEvidence, setExposeEvidence] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const mint = async () => {
    setError(null);
    setCreating(true);
    try {
      const res = await fetch(`/api/extractions/${extractionId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exposeEvidence }),
      });
      const body = (await res.json()) as { url?: string; error?: string; detail?: string };
      if (!res.ok || !body.url) {
        setError(body.detail ?? body.error ?? `Failed (HTTP ${res.status})`);
        setCreating(false);
        return;
      }
      setUrl(body.url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          setOpen(true);
          setUrl(null);
          setError(null);
        }}
      >
        <Link2 className="h-4 w-4" />
        Share
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share this extraction</DialogTitle>
            <DialogDescription>
              Mint a public read-only URL. Anyone with the link can view the tokens, audits, and
              downloadable outputs. No sign-in required.
            </DialogDescription>
          </DialogHeader>

          <label className="mb-4 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={exposeEvidence}
              onChange={(e) => setExposeEvidence(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-[var(--color-border)]"
            />
            <span>
              <strong className="block">Include evidence trail</strong>
              <span className="text-[var(--color-muted)]">
                Lets viewers see the DOM selector / raw text behind every token. Uncheck to hide
                source references.
              </span>
            </span>
          </label>

          {url ? (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
              <code className="flex-1 truncate font-mono text-xs">{url}</code>
              <Button size="sm" variant="ghost" onClick={copy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          ) : (
            <div className="flex justify-end">
              <Button onClick={mint} disabled={creating}>
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  'Create share link'
                )}
              </Button>
            </div>
          )}

          {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
