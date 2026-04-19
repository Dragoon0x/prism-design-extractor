import Link from 'next/link';
import { Github, Sparkles } from 'lucide-react';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--color-border)] bg-[color-mix(in_oklch,var(--color-bg)_85%,transparent)] backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-6">
        <Link
          href="/"
          className="group flex items-center gap-2 text-sm font-semibold tracking-tight"
        >
          <span className="grid h-6 w-6 place-items-center rounded-md bg-[var(--color-accent)] text-[var(--color-accent-fg)] transition group-hover:rotate-12">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          Prism
        </Link>
        <nav className="flex items-center gap-4 text-sm text-[var(--color-muted)]">
          <Link className="hover:text-[var(--color-fg)]" href="/about">
            About
          </Link>
          <Link className="hover:text-[var(--color-fg)]" href="/settings">
            Settings
          </Link>
          <a
            className="inline-flex items-center gap-1 hover:text-[var(--color-fg)]"
            href="https://github.com/REPLACE_ME/prism"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Github className="h-4 w-4" />
            GitHub
          </a>
        </nav>
      </div>
    </header>
  );
}
