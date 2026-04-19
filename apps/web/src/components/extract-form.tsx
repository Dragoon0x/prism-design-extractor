'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { upload } from '@vercel/blob/client';
import { FileUp, KeyRound, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ByokDialog } from '@/components/byok-dialog';
import { getApiKey } from '@/lib/byok';
import { cn } from '@/lib/utils';

const ACCEPTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
];

const ACCEPTED_PDF_TYPES = ['application/pdf'];

const ACCEPTED_UPLOAD_TYPES = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_PDF_TYPES];

function classifyUpload(file: File): 'image' | 'pdf' | null {
  if (ACCEPTED_IMAGE_TYPES.includes(file.type)) return 'image';
  if (ACCEPTED_PDF_TYPES.includes(file.type) || file.name.toLowerCase().endsWith('.pdf')) return 'pdf';
  return null;
}

export function ExtractForm() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string>('Starting…');
  const [error, setError] = useState<string | null>(null);
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const submitUrl = async (keyOverride?: string) => {
    setError(null);
    const trimmed = value.trim();
    if (!trimmed) {
      setError('Paste a URL or drop an image to extract.');
      return;
    }
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      setError('That doesn\'t look like a valid URL. Include http(s)://');
      return;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      setError('Only http and https URLs are supported.');
      return;
    }

    const apiKey = keyOverride ?? getApiKey();
    if (!apiKey) {
      setKeyDialogOpen(true);
      return;
    }

    setBusy(true);
    setBusyLabel('Starting…');
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Anthropic-Key': apiKey },
        body: JSON.stringify({ input: url.href, inputType: 'url' }),
      });
      const body = (await res.json()) as { extractionId?: string; error?: string; detail?: string };
      if (!res.ok || !body.extractionId) {
        setError(body.detail ?? body.error ?? `Failed (HTTP ${res.status})`);
        setBusy(false);
        return;
      }
      router.push(`/run/${body.extractionId}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const submitFile = async (file: File, keyOverride?: string) => {
    setError(null);
    const kind = classifyUpload(file);
    if (!kind) {
      setError(`Unsupported file type: ${file.type || file.name.split('.').pop() || 'unknown'}.`);
      return;
    }
    const maxBytes = kind === 'pdf' ? 50 * 1024 * 1024 : 20 * 1024 * 1024;
    if (file.size > maxBytes) {
      setError(`${kind === 'pdf' ? 'PDF' : 'Image'} must be under ${maxBytes / 1024 / 1024} MB.`);
      return;
    }

    const apiKey = keyOverride ?? getApiKey();
    if (!apiKey) {
      setPendingFile(file);
      setKeyDialogOpen(true);
      return;
    }

    setBusy(true);
    setBusyLabel('Uploading…');
    try {
      const safeName = file.name.replace(/[^\w.-]/g, '_');
      const blob = await upload(`extractions/uploads/${Date.now()}-${safeName}`, file, {
        access: 'public',
        handleUploadUrl: '/api/upload',
      });
      setBusyLabel('Queueing…');
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Anthropic-Key': apiKey },
        body: JSON.stringify({
          input: blob.url,
          inputRef: blob.url,
          inputType: kind,
        }),
      });
      const body = (await res.json()) as { extractionId?: string; error?: string; detail?: string };
      if (!res.ok || !body.extractionId) {
        setError(body.detail ?? body.error ?? `Failed (HTTP ${res.status})`);
        setBusy(false);
        return;
      }
      router.push(`/run/${body.extractionId}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    dragCounter.current = 0;
    const file = e.dataTransfer.files?.[0];
    if (file) void submitFile(file);
  };

  const onKeySaved = (key: string) => {
    if (pendingFile) {
      const f = pendingFile;
      setPendingFile(null);
      void submitFile(f, key);
    } else {
      void submitUrl(key);
    }
  };


  return (
    <>
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          dragCounter.current += 1;
          if (e.dataTransfer.types.includes('Files')) setDragActive(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => {
          dragCounter.current = Math.max(0, dragCounter.current - 1);
          if (dragCounter.current === 0) setDragActive(false);
        }}
        onDrop={handleDrop}
        className={cn(
          'relative flex w-full max-w-2xl flex-col gap-3 rounded-2xl border bg-[var(--color-surface)] p-4 shadow-sm transition',
          dragActive
            ? 'border-[var(--color-accent)] ring-2 ring-[color-mix(in_oklch,var(--color-accent)_30%,transparent)]'
            : 'border-[var(--color-border)]',
        )}
      >
        <form
          aria-label="Extract from input"
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submitUrl();
          }}
        >
          <label htmlFor="input" className="text-sm font-medium">
            Paste a URL, or drop a screenshot
          </label>
          <Input
            id="input"
            name="input"
            autoFocus
            spellCheck={false}
            autoComplete="off"
            placeholder="https://stripe.com"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            disabled={busy}
          />
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={busy} className="flex-1">
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {busyLabel}
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Extract from URL
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              title="Upload a screenshot or PDF"
            >
              <FileUp className="h-4 w-4" />
              Upload file
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={busy}
              title="Manage API key"
              onClick={() => setKeyDialogOpen(true)}
            >
              <KeyRound className="h-4 w-4" />
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_UPLOAD_TYPES.join(',')}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void submitFile(file);
              e.target.value = '';
            }}
          />
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <p className="text-xs text-[var(--color-muted)]">
            PNG / JPG / WEBP / SVG up to 20 MB, or PDF up to 50 MB (max 30 pages). Your key
            stays in localStorage; it&apos;s sent once per extraction, never stored server-side.
          </p>
        </form>
        {dragActive && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl bg-[color-mix(in_oklch,var(--color-accent)_12%,var(--color-bg))] text-sm font-medium text-[var(--color-accent)]">
            Drop image or PDF to extract
          </div>
        )}
      </div>

      <ByokDialog
        open={keyDialogOpen}
        onOpenChange={(o) => {
          setKeyDialogOpen(o);
          if (!o && !getApiKey()) setPendingFile(null);
        }}
        onSaved={onKeySaved}
      />
    </>
  );
}
