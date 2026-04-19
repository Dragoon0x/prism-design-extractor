'use client';

import { useEffect } from 'react';
import { TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to the browser console; our structured logger on the server runs separately.
    console.error('[prism] render error', error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
        <TriangleAlert className="h-6 w-6" />
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">Something broke.</h1>
      <p className="text-[var(--color-muted)]">
        {error.message || 'An unexpected error occurred rendering this page.'}
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-[var(--color-muted)]">digest: {error.digest}</p>
      )}
      <div className="mt-2 flex gap-2">
        <Button onClick={() => reset()}>Try again</Button>
        <Button variant="ghost" onClick={() => (window.location.href = '/')}>
          Home
        </Button>
      </div>
    </main>
  );
}
