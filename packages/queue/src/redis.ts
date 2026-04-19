/**
 * Upstash Redis factory.
 *
 * Two connection styles:
 *   - `@upstash/redis` REST client  — for HTTP-friendly ops in Vercel functions (rate limit counters, pub, scan).
 *   - `subscribe(...)` helper below — opens a raw TCP TLS stream to Upstash so we can read pub/sub from SSE routes.
 *
 * The REST client is sufficient for 90% of use. The TCP stream is only needed
 * where we literally need long-lived subscription — the SSE endpoint.
 */
import { Redis } from '@upstash/redis';

let cached: Redis | undefined;

/** Returns a singleton Upstash REST client. Reads env on first call. */
export function getRedis(): Redis {
  if (!cached) {
    cached = Redis.fromEnv();
  }
  return cached;
}

/**
 * Open a long-lived Redis pub/sub subscription via Upstash's HTTPS SSE endpoint.
 * Yields parsed message strings. Aborts when the `signal` fires.
 *
 * This uses the `/subscribe/<channel>` endpoint Upstash exposes on top of standard Redis
 * pub/sub. It returns an SSE stream, which we forward 1:1 to the browser client.
 */
export async function* subscribe(
  channel: string,
  opts: { signal: AbortSignal; url: string; token: string },
): AsyncGenerator<string, void, unknown> {
  const url = `${opts.url.replace(/\/$/, '')}/subscribe/${encodeURIComponent(channel)}`;
  const response = await fetch(url, {
    method: 'GET',
    signal: opts.signal,
    headers: {
      Authorization: `Bearer ${opts.token}`,
      Accept: 'text/event-stream',
    },
  });
  if (!response.ok || !response.body) {
    throw new Error(`subscribe failed: HTTP ${response.status}`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      if (opts.signal.aborted) return;
      const { value, done } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const event = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        // SSE lines prefixed with "data: " carry the payload.
        for (const line of event.split('\n')) {
          const m = /^data:\s?(.*)$/.exec(line);
          if (m && m[1]) yield m[1];
        }
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // no-op
    }
  }
}
