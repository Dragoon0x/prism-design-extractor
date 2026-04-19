import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Disclaimer banner / card. Appears on the landing page and the about page
 * so users can't miss it. Full legal text lives at /DISCLAIMER.md in the repo.
 */
export function DisclaimerNotice({
  variant = 'card',
  className,
}: {
  variant?: 'card' | 'banner' | 'compact';
  className?: string;
}) {
  if (variant === 'compact') {
    return (
      <p
        className={cn(
          'text-balance text-[11px] text-[var(--color-muted)]',
          className,
        )}
      >
        ⚠ Experimental / educational use only. Outputs are AI-generated — <strong>DYOR</strong>.
        Authors + project assume no liability.{' '}
        <a
          className="underline hover:text-[var(--color-fg)]"
          href="https://github.com/Dragoon0x/prism-design-extractor/blob/main/DISCLAIMER.md"
          target="_blank"
          rel="noopener noreferrer"
        >
          Full disclaimer
        </a>
        .
      </p>
    );
  }

  if (variant === 'banner') {
    return (
      <div
        className={cn(
          'flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900',
          className,
        )}
        role="note"
      >
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <strong>Experimental / educational use only.</strong> Outputs are AI-generated and may
          be wrong — <strong>DYOR</strong> before using them. Authors + project take no
          liability.{' '}
          <a
            className="underline"
            href="https://github.com/Dragoon0x/prism-design-extractor/blob/main/DISCLAIMER.md"
            target="_blank"
            rel="noopener noreferrer"
          >
            Full disclaimer →
          </a>
        </p>
      </div>
    );
  }

  return (
    <section
      className={cn(
        'w-full rounded-2xl border border-amber-200 bg-amber-50/60 p-5 text-sm text-amber-900',
        className,
      )}
      role="note"
    >
      <div className="mb-2 flex items-center gap-2 font-semibold">
        <TriangleAlert className="h-4 w-4" />
        Disclaimer — educational & experimental
      </div>
      <ul className="space-y-1.5 text-[13px] leading-relaxed">
        <li>
          Prism is a research project distributed <strong>&ldquo;AS IS&rdquo;</strong>. Outputs
          (tokens, components, audits, generated code) come from AI models and may be inaccurate
          or incomplete.
        </li>
        <li>
          <strong>Do your own research (DYOR)</strong> before using any Prism output in production.
          Treat generated files as pull-request suggestions, not source of truth.
        </li>
        <li>
          The authors, contributors, and project take <strong>no responsibility and no liability</strong>{' '}
          for any damage, loss, cost, or consequence from using this software, the hosted demo, or
          its outputs.
        </li>
        <li>
          <strong>You alone are responsible</strong> for your Anthropic API billing (BYOK), the
          legal right to extract your inputs (copyright, terms of service, robots.txt), and any
          decisions derived from the output.
        </li>
        <li>
          Not affiliated with Anthropic, Vercel, Neon, Upstash, or any brand whose site or design
          you extract.
        </li>
      </ul>
      <p className="mt-3 text-xs">
        Full text:{' '}
        <Link
          className="underline"
          href="https://github.com/Dragoon0x/prism-design-extractor/blob/main/DISCLAIMER.md"
          target="_blank"
          rel="noopener noreferrer"
        >
          DISCLAIMER.md
        </Link>
        .
      </p>
    </section>
  );
}
