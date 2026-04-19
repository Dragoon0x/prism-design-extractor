import Link from 'next/link';
import {
  Eye,
  FileCode2,
  FileJson,
  FileText,
  GitCompare,
  Layers,
  ScanLine,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { ExtractForm } from '@/components/extract-form';

const ARTIFACTS: { icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { icon: FileText, label: 'DESIGN.md' },
  { icon: FileJson, label: 'design-tokens.json' },
  { icon: FileCode2, label: 'tailwind.config.ts' },
  { icon: FileCode2, label: 'tokens.css' },
  { icon: FileCode2, label: '_tokens.scss' },
  { icon: FileCode2, label: 'tokens.ts (CSS-in-JS)' },
  { icon: FileJson, label: 'figma-tokens.json' },
  { icon: FileJson, label: 'sd.config.json' },
  { icon: Layers, label: 'Storybook stories' },
  { icon: Layers, label: 'React scaffolds' },
  { icon: Layers, label: 'Asset bundle ZIP' },
  { icon: Layers, label: 'Static docs site ZIP' },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-4xl flex-col items-center gap-16 px-6 py-16">
      <section className="flex w-full flex-col items-center gap-10">
        <header className="flex flex-col items-center gap-3 text-center">
          <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 font-mono text-[11px] uppercase tracking-widest text-[var(--color-muted)]">
            open source · BYOK · v0.1
          </span>
          <h1 className="text-balance text-5xl font-semibold tracking-tight sm:text-6xl">
            Extract a design system from anything.
          </h1>
          <p className="max-w-2xl text-balance text-lg text-[var(--color-muted)]">
            Paste a URL, drop a screenshot, upload a PDF. Prism captures design across four
            viewports, runs Claude vision over the pixels, clusters what it sees, and emits
            thirteen production-ready artifacts — with an evidence trail linking every token
            to where it came from.
          </p>
        </header>

        <ExtractForm />

        <ul className="flex flex-wrap justify-center gap-2">
          {ARTIFACTS.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 font-mono text-xs text-[var(--color-muted)]"
            >
              <Icon className="h-3 w-3" />
              {label}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid w-full gap-6 md:grid-cols-3">
        <HowCard
          icon={ScanLine}
          title="Capture"
          body="Playwright on serverless Chromium for URLs across four viewports. Sharp for screenshots. pdfjs fan-out for PDFs."
        />
        <HowCard
          icon={Eye}
          title="Reason"
          body="Claude Sonnet 4.6 extracts; Opus 4.7 names (primary / surface / destructive); deterministic audits flag contrast failures, magic values, duplicates."
        />
        <HowCard
          icon={GitCompare}
          title="Emit"
          body="Thirteen formats from one canonical tree. Stable token ids mean diffs across re-extractions are deterministic too."
        />
      </section>

      <section className="w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-md">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4 text-[var(--color-accent)]" />
              Your key, your wallet, your rules.
            </h2>
            <p className="mt-2 text-sm text-[var(--color-muted)]">
              Every extraction runs on your Anthropic API key. Prism never holds API-cost
              liability. The key lives in your browser, sent once per request, never logged.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm hover:bg-[color-mix(in_oklch,var(--color-bg)_95%,var(--color-fg)_5%)]"
              href="/settings"
            >
              Manage key
            </Link>
            <Link
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-2 text-sm text-[var(--color-accent-fg)]"
              href="/about"
            >
              <Sparkles className="h-4 w-4" />
              Learn more
            </Link>
          </div>
        </div>
      </section>

      <footer className="flex items-center gap-4 pb-8 text-xs text-[var(--color-muted)]">
        <a
          className="hover:text-[var(--color-fg)]"
          href="https://github.com/REPLACE_ME/prism"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
        <span>·</span>
        <Link className="hover:text-[var(--color-fg)]" href="/about">
          About
        </Link>
        <span>·</span>
        <Link className="hover:text-[var(--color-fg)]" href="/settings">
          Settings
        </Link>
        <span>·</span>
        <span className="font-mono">MIT</span>
      </footer>
    </main>
  );
}

function HowCard({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-[color-mix(in_oklch,var(--color-accent)_15%,var(--color-bg))] text-[var(--color-accent)]">
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-[var(--color-muted)]">{body}</p>
    </div>
  );
}
