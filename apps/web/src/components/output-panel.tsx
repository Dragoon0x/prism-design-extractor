'use client';

import { useState } from 'react';
import { Check, Copy, Download, FileCode2 } from 'lucide-react';
import type { OutputFormat } from '@prism/shared';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const FORMAT_META: Record<OutputFormat, { label: string; ext: string; description: string }> = {
  'design-md-compact': { label: 'DESIGN.md (compact)', ext: 'md', description: 'AI-agent brief ≤ 8K tokens' },
  'design-md-extended': { label: 'DESIGN.md (extended)', ext: 'md', description: 'Full dump with evidence + cost' },
  'design-tokens-json': { label: 'design-tokens.json', ext: 'json', description: 'W3C DTCG format' },
  'tailwind-config': { label: 'tailwind.config.ts', ext: 'ts', description: 'Drop-in Tailwind 3+/v4 config' },
  'css-variables': { label: 'tokens.css', ext: 'css', description: ':root custom properties' },
  'scss': { label: '_tokens.scss', ext: 'scss', description: 'SCSS $-maps per category' },
  'css-in-js': { label: 'tokens.ts', ext: 'ts', description: 'Typed `as const` object' },
  'figma-tokens-json': { label: 'figma-tokens.json', ext: 'json', description: 'Tokens Studio schema — Phase 9' },
  'storybook-stories': { label: 'stories/', ext: 'tsx', description: 'Per-component stories — Phase 9' },
  'react-component-scaffolds': { label: 'components/', ext: 'tsx', description: 'React scaffolds — Phase 9' },
  'style-dictionary-config': { label: 'sd.config.json', ext: 'json', description: 'Style Dictionary — Phase 9' },
  'docs-site-zip': { label: 'docs-site.zip', ext: 'zip', description: 'Downloadable docs site — Phase 9' },
  'asset-bundle-zip': { label: 'assets.zip', ext: 'zip', description: 'Asset manifest — Phase 9' },
};

export interface ArtifactRecord {
  format: OutputFormat;
  filename: string;
  url: string;
  bytes: number;
  hash: string;
}

export function OutputPanel({ artifacts }: { artifacts: ArtifactRecord[] }) {
  const [selected, setSelected] = useState<ArtifactRecord | null>(artifacts[0] ?? null);
  const [preview, setPreview] = useState<string>('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadPreview = async (a: ArtifactRecord) => {
    setSelected(a);
    setLoadingPreview(true);
    setPreview('');
    try {
      const res = await fetch(a.url);
      const text = await res.text();
      setPreview(text);
    } catch (err) {
      setPreview(`[preview unavailable: ${(err as Error).message}]`);
    } finally {
      setLoadingPreview(false);
    }
  };

  const copy = async () => {
    if (!preview) return;
    await navigator.clipboard.writeText(preview);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (artifacts.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        Outputs are generated right after extraction completes. Refresh in a moment.
      </p>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <ul className="space-y-1">
        {artifacts.map((a) => {
          const meta = FORMAT_META[a.format];
          const isActive = selected?.format === a.format;
          return (
            <li key={a.format}>
              <button
                type="button"
                onClick={() => void loadPreview(a)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-lg border border-transparent p-3 text-left transition hover:bg-[var(--color-surface)]',
                  isActive && 'border-[var(--color-border)] bg-[var(--color-surface)]',
                )}
              >
                <FileCode2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-muted)]" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{meta.label}</span>
                    <Badge tone="neutral">{(a.bytes / 1024).toFixed(1)} KB</Badge>
                  </div>
                  <p className="truncate text-xs text-[var(--color-muted)]">
                    {meta.description}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="rounded-xl border border-[var(--color-border)] bg-white">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2">
          <span className="truncate font-mono text-xs text-[var(--color-muted)]">
            {selected?.filename ?? '—'}
          </span>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={copy} disabled={!preview}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            {selected && (
              <a
                href={selected.url}
                download={selected.filename}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--color-fg)] hover:bg-[var(--color-surface)]"
              >
                <Download className="h-4 w-4" />
                Download
              </a>
            )}
          </div>
        </div>
        <pre className="max-h-[70vh] overflow-auto p-4 text-xs leading-relaxed">
          {loadingPreview ? (
            <span className="text-[var(--color-muted)]">Loading…</span>
          ) : (
            preview || (
              <span className="text-[var(--color-muted)]">Click a format to preview.</span>
            )
          )}
        </pre>
      </div>
    </div>
  );
}
