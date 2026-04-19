import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <span className="font-mono text-[11px] uppercase tracking-widest text-[var(--color-muted)]">
        404
      </span>
      <h1 className="text-3xl font-semibold tracking-tight">
        This extraction wandered off.
      </h1>
      <p className="text-[var(--color-muted)]">
        The URL you followed doesn&apos;t correspond to a known extraction, share, or page.
      </p>
      <Link href="/" className="mt-2">
        <Button>Start a new extraction</Button>
      </Link>
    </main>
  );
}
