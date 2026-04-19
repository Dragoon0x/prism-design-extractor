/**
 * GET /api/stream/[id] — Server-Sent Events for an extraction in progress.
 *
 * Subscribes to the Upstash Redis pub/sub channel and relays each delta to
 * the browser as SSE. Closes when a `final` or `stage:failed` delta arrives.
 */
import { subscribe } from '@prism/queue';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  if (!id || !/^[0-9a-fA-F-]{36}$/.test(id)) {
    return new Response('invalid id', { status: 400 });
  }
  const abort = new AbortController();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: string) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`));
      };
      send('ready', JSON.stringify({ extractionId: id }));

      // Heartbeat: prevent proxies / Vercel from closing idle streams.
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15_000);

      try {
        const channel = `prism:delta:${id}`;
        for await (const payload of subscribe(channel, {
          signal: abort.signal,
          url: env.UPSTASH_REDIS_REST_URL,
          token: env.UPSTASH_REDIS_REST_TOKEN,
        })) {
          send('delta', payload);
          try {
            const parsed = JSON.parse(payload) as { type: string; status?: string };
            if (parsed.type === 'final' || (parsed.type === 'stage' && parsed.status === 'failed')) {
              send('done', JSON.stringify({ extractionId: id }));
              break;
            }
          } catch {
            // ignore
          }
        }
      } catch (err) {
        send('error', JSON.stringify({ message: (err as Error).message }));
      } finally {
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
