/**
 * SSE client hook. Subscribes to `/api/stream/:id`, validates every delta
 * against the Zod schema, and calls the provided callback.
 */
'use client';

import { useEffect, useRef } from 'react';
import { extractionDeltaSchema, type ExtractionDelta } from '@prism/shared';

export interface UseExtractionStreamOptions {
  extractionId: string;
  onDelta: (delta: ExtractionDelta) => void;
  onError?: (message: string) => void;
  onDone?: () => void;
}

export function useExtractionStream({
  extractionId,
  onDelta,
  onError,
  onDone,
}: UseExtractionStreamOptions): void {
  const onDeltaRef = useRef(onDelta);
  const onErrorRef = useRef(onError);
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDeltaRef.current = onDelta;
    onErrorRef.current = onError;
    onDoneRef.current = onDone;
  }, [onDelta, onError, onDone]);

  useEffect(() => {
    if (!extractionId) return;
    const source = new EventSource(`/api/stream/${extractionId}`);
    source.addEventListener('delta', (e) => {
      try {
        const raw = JSON.parse((e as MessageEvent).data);
        const parsed = extractionDeltaSchema.safeParse(raw);
        if (parsed.success) onDeltaRef.current(parsed.data);
      } catch (err) {
        console.error('[sse] bad delta', err);
      }
    });
    source.addEventListener('error', (e) => {
      const msg = (e as MessageEvent).data ?? 'stream error';
      try {
        const parsed = JSON.parse(msg);
        onErrorRef.current?.(parsed.message ?? String(msg));
      } catch {
        onErrorRef.current?.(String(msg));
      }
    });
    source.addEventListener('done', () => {
      onDoneRef.current?.();
      source.close();
    });
    source.addEventListener('ready', () => {
      // connection established
    });
    return () => source.close();
  }, [extractionId]);
}
