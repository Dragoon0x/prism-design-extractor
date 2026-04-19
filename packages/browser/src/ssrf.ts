/**
 * SSRF guard. Every URL Prism navigates to is vetted here FIRST.
 *
 * Rules:
 *   1. Scheme must be http(s).
 *   2. Host must not resolve to a private, loopback, link-local, or reserved IP.
 *   3. Port must be in the allowed list (80, 443, 8080, 8443).
 *   4. Optional environment blocklist of domains (comma-separated `DOMAIN_BLOCKLIST`).
 *   5. Redirects re-run the same guard per hop.
 *
 * The guard is enforced at two layers:
 *   - Pre-navigation validation (`assertSafeUrl`).
 *   - Playwright request interception that aborts navigations to private IPs
 *     *even if* DNS is poisoned mid-flight (`installSsrfInterceptor`).
 */
import { promises as dns } from 'node:dns';
import { isIPv4, isIPv6 } from 'node:net';
import type { Page, Route } from 'playwright-core';

const ALLOWED_PORTS = new Set<number>([80, 443, 8080, 8443]);

export class SsrfError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'bad-scheme'
      | 'bad-port'
      | 'private-ip'
      | 'blocklisted'
      | 'dns-failure',
  ) {
    super(message);
    this.name = 'SsrfError';
  }
}

/** Throws `SsrfError` if the URL is not safe to navigate. */
export async function assertSafeUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfError(`invalid URL: ${rawUrl}`, 'bad-scheme');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SsrfError(`scheme "${url.protocol}" is not allowed`, 'bad-scheme');
  }
  const port = url.port
    ? Number(url.port)
    : url.protocol === 'https:'
      ? 443
      : 80;
  if (!ALLOWED_PORTS.has(port)) {
    throw new SsrfError(`port ${port} is not allowed`, 'bad-port');
  }
  const blocklist = (process.env.DOMAIN_BLOCKLIST ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (blocklist.some((d) => url.hostname === d || url.hostname.endsWith(`.${d}`))) {
    throw new SsrfError(`host ${url.hostname} is blocklisted`, 'blocklisted');
  }
  const addresses = await resolveHost(url.hostname);
  for (const addr of addresses) {
    if (isPrivateIp(addr)) {
      throw new SsrfError(`host ${url.hostname} resolves to private IP ${addr}`, 'private-ip');
    }
  }
  return url;
}

async function resolveHost(hostname: string): Promise<string[]> {
  // Literal IPs never touch DNS.
  if (isIPv4(hostname) || isIPv6(hostname)) return [hostname];
  try {
    const [a, aaaa] = await Promise.allSettled([
      dns.resolve4(hostname),
      dns.resolve6(hostname),
    ]);
    const results: string[] = [];
    if (a.status === 'fulfilled') results.push(...a.value);
    if (aaaa.status === 'fulfilled') results.push(...aaaa.value);
    if (results.length === 0) throw new Error('no A/AAAA records');
    return results;
  } catch (err) {
    throw new SsrfError(
      `DNS resolution failed for ${hostname}: ${(err as Error).message}`,
      'dns-failure',
    );
  }
}

/**
 * Returns true if the address is in any reserved / private / loopback range.
 * IPv4: 10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, 100.64/10 (CGNAT),
 *       0/8, 224/4 (multicast), 240/4 (reserved).
 * IPv6: ::1, fc00::/7, fe80::/10, ::, ::ffff:0:0/96 (mapped IPv4 — recurses).
 */
export function isPrivateIp(addr: string): boolean {
  if (isIPv4(addr)) {
    const [a, b] = addr.split('.').map(Number) as [number, number, number, number];
    if (a === undefined || b === undefined) return true;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (isIPv6(addr)) {
    const lower = addr.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    if (lower.startsWith('fe80:')) return true;
    const mapped = /^::ffff:([\d.]+)$/i.exec(lower);
    if (mapped && mapped[1]) return isPrivateIp(mapped[1]);
    return false;
  }
  // Unknown format — default to unsafe.
  return true;
}

/**
 * Install a Playwright request interceptor that aborts requests to private IPs
 * at navigation time. Safety net in case DNS changes between `assertSafeUrl`
 * and the actual fetch.
 */
export async function installSsrfInterceptor(page: Page): Promise<void> {
  await page.route('**/*', async (route: Route) => {
    try {
      const url = new URL(route.request().url());
      if (url.protocol === 'data:' || url.protocol === 'blob:') {
        return route.continue();
      }
      await assertSafeUrl(url.href);
      return route.continue();
    } catch (err) {
      console.warn(`[ssrf] aborted ${route.request().url()}: ${(err as Error).message}`);
      return route.abort('blockedbyclient');
    }
  });
}
