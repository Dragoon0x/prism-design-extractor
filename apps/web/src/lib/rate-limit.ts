import { Ratelimit } from '@upstash/ratelimit';
import { getRedis } from '@prism/queue';
import { env } from './env.js';

/** Anonymous users, keyed by IP. */
export const anonLimiter = new Ratelimit({
  redis: getRedis(),
  limiter: Ratelimit.slidingWindow(env.RATE_LIMIT_ANON_PER_HOUR, '1 h'),
  analytics: true,
  prefix: 'prism:rl:anon',
});

/** Signed-in users, keyed by user id. */
export const signedLimiter = new Ratelimit({
  redis: getRedis(),
  limiter: Ratelimit.slidingWindow(env.RATE_LIMIT_SIGNED_PER_HOUR, '1 h'),
  analytics: true,
  prefix: 'prism:rl:signed',
});

export function clientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  const real = request.headers.get('x-real-ip');
  if (real) return real;
  return 'unknown';
}
