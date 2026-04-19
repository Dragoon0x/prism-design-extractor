'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, KeyRound } from 'lucide-react';
import { apiKeyPreview, clearApiKey, getApiKey, isPlausibleApiKey, setApiKey } from '@/lib/byok';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export function ByokDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (key: string) => void;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentPreview, setCurrentPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const existing = getApiKey();
    setCurrentPreview(existing ? apiKeyPreview(existing) : null);
    setValue('');
    setError(null);
  }, [open]);

  const save = () => {
    const trimmed = value.trim();
    if (!isPlausibleApiKey(trimmed)) {
      setError('This doesn\'t look like an Anthropic API key (sk-ant-…).');
      return;
    }
    setApiKey(trimmed);
    onSaved?.(trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Anthropic API key
          </DialogTitle>
          <DialogDescription>
            Prism is bring-your-own-key. Your key stays in this browser — it&apos;s sent once per
            extraction, never stored on our server.
          </DialogDescription>
        </DialogHeader>
        {currentPreview && (
          <div className="mb-3 flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm">
            <span>
              Current: <code className="font-mono">{currentPreview}</code>
            </span>
            <button
              type="button"
              onClick={() => {
                clearApiKey();
                setCurrentPreview(null);
              }}
              className="text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
            >
              Remove
            </button>
          </div>
        )}
        <label htmlFor="apikey" className="mb-1.5 block text-sm font-medium">
          Paste your key
        </label>
        <Input
          id="apikey"
          type="password"
          spellCheck={false}
          autoComplete="off"
          placeholder="sk-ant-…"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save();
          }}
        />
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
        <div className="mt-5 flex items-center justify-between">
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
          >
            Get a key
            <ExternalLink className="h-3 w-3" />
          </a>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Save key</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
