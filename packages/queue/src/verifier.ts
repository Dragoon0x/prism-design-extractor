/**
 * QStash signature verification for Next.js route handlers.
 *
 * Every worker route MUST call `verifyQStashRequest(request)` before trusting
 * its body. Unsigned requests are rejected with 401.
 */
import { Receiver } from '@upstash/qstash';

let cachedReceiver: Receiver | undefined;

function getReceiver(): Receiver {
  if (!cachedReceiver) {
    const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
    const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
    if (!currentSigningKey || !nextSigningKey) {
      throw new Error('QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY are required');
    }
    cachedReceiver = new Receiver({ currentSigningKey, nextSigningKey });
  }
  return cachedReceiver;
}

/**
 * Verify the incoming request carries a valid QStash signature.
 * Returns the raw body string so the caller can parse it with a Zod schema
 * (reading the body twice is not possible with the fetch stream).
 */
export async function verifyQStashRequest(request: Request): Promise<string> {
  const signature = request.headers.get('upstash-signature');
  if (!signature) {
    throw new QStashUnauthorizedError('missing upstash-signature header');
  }
  const body = await request.text();
  const receiver = getReceiver();
  const ok = await receiver.verify({
    signature,
    body,
    url: request.url,
  });
  if (!ok) {
    throw new QStashUnauthorizedError('signature verification failed');
  }
  return body;
}

export class QStashUnauthorizedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QStashUnauthorizedError';
  }
}
