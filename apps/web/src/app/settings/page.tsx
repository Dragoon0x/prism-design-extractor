'use client';

import { useEffect, useState } from 'react';
import { KeyRound, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { DisclaimerNotice } from '@/components/disclaimer-notice';
import { Input } from '@/components/ui/input';
import { apiKeyPreview, clearApiKey, getApiKey, isPlausibleApiKey, setApiKey } from '@/lib/byok';

export default function SettingsPage() {
  const [preview, setPreview] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const existing = getApiKey();
    setPreview(existing ? apiKeyPreview(existing) : null);
  }, []);

  const save = () => {
    setError(null);
    setSaved(false);
    const trimmed = value.trim();
    if (!isPlausibleApiKey(trimmed)) {
      setError('This doesn\'t look like an Anthropic API key (sk-ant-…).');
      return;
    }
    setApiKey(trimmed);
    setValue('');
    setPreview(apiKeyPreview(trimmed));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const remove = () => {
    clearApiKey();
    setPreview(null);
    setSaved(false);
  };

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Prism is bring-your-own-key. Your Anthropic API key stays in this browser only.
        </p>
      </header>

      <Card>
        <CardHeader className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-[var(--color-muted)]" />
          <h2 className="text-sm font-semibold">Anthropic API key</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-[var(--color-muted)]">
              Current
            </div>
            <div className="mt-1 flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-mono text-sm">
              <span>{preview ?? 'none'}</span>
              {preview && (
                <Button size="sm" variant="ghost" onClick={remove}>
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="new-key" className="mb-1.5 block text-sm font-medium">
              Update key
            </label>
            <div className="flex gap-2">
              <Input
                id="new-key"
                type="password"
                placeholder="sk-ant-…"
                autoComplete="off"
                spellCheck={false}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError(null);
                  setSaved(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') save();
                }}
              />
              <Button onClick={save}>
                <Save className="h-4 w-4" />
                Save
              </Button>
            </div>
            {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
            {saved && <p className="mt-2 text-sm text-emerald-700">Saved.</p>}
          </div>

          <p className="text-xs text-[var(--color-muted)]">
            Get a key at{' '}
            <a
              href="https://console.anthropic.com/settings/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              console.anthropic.com/settings/keys
            </a>
            . It is sent once per extraction as the <code>X-Anthropic-Key</code> header and never
            stored on our server.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold">Privacy</h2>
        </CardHeader>
        <CardBody className="text-sm text-[var(--color-muted)]">
          <ul className="space-y-2">
            <li>
              • Your API key lives only in <code>localStorage</code> on this device.
            </li>
            <li>
              • Extractions, screenshots, and generated outputs are stored in the project&apos;s
              Vercel Blob bucket. Share links are public by default.
            </li>
            <li>
              • Server logs never contain your API key — they&apos;re scrubbed by a regex pass on
              every log line before they leave the process.
            </li>
            <li>
              • The full source is open — the{' '}
              <a
                href="https://github.com/Dragoon0x/prism-design-extractor"
                className="underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                repo
              </a>{' '}
              is the source of truth for everything this app does.
            </li>
            <li>
              • <strong>You</strong> are responsible for every dollar spent on the key you paste
              below. Prism does not cap cost per request — an extraction on a large site can cost
              meaningful Claude credits.
            </li>
          </ul>
        </CardBody>
      </Card>

      <DisclaimerNotice variant="card" />
    </main>
  );
}
