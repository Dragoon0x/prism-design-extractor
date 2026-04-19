/**
 * Minimal robots.txt check. We don't implement the full spec — we honor
 * `Disallow:` rules for `User-agent: *` and our own UA string.
 *
 * If robots.txt is unreachable we fail OPEN (allow the extraction). If robots
 * parses but disallows the path, we throw.
 */

const UA = 'PrismBot';

export class RobotsDisallowedError extends Error {
  constructor(public readonly url: string) {
    super(`robots.txt disallows extraction of ${url}`);
    this.name = 'RobotsDisallowedError';
  }
}

interface RobotsRuleSet {
  userAgent: string;
  disallow: string[];
  allow: string[];
}

function parse(text: string): RobotsRuleSet[] {
  const groups: RobotsRuleSet[] = [];
  let current: RobotsRuleSet | undefined;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split('#')[0]?.trim() ?? '';
    if (!line) continue;
    const [field, ...rest] = line.split(':');
    if (!field || rest.length === 0) continue;
    const key = field.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (key === 'user-agent') {
      if (!current || current.disallow.length || current.allow.length) {
        current = { userAgent: value.toLowerCase(), disallow: [], allow: [] };
        groups.push(current);
      } else {
        current.userAgent = value.toLowerCase();
      }
    } else if (key === 'disallow' && current) {
      current.disallow.push(value);
    } else if (key === 'allow' && current) {
      current.allow.push(value);
    }
  }
  return groups;
}

function matches(pattern: string, pathname: string): boolean {
  if (pattern === '') return false;
  // Very basic glob support: `*` wildcard, `$` end-anchor.
  const regex = new RegExp(
    '^' +
      pattern
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')
        .replace(/\\\$$/, '$') +
      (pattern.endsWith('$') ? '' : ''),
  );
  return regex.test(pathname);
}

export async function isAllowedByRobots(url: URL, signal?: AbortSignal): Promise<boolean> {
  const robotsUrl = new URL('/robots.txt', url);
  try {
    const res = await fetch(robotsUrl, {
      method: 'GET',
      headers: { 'User-Agent': UA },
      ...(signal ? { signal } : {}),
    });
    if (!res.ok) return true; // no robots → allow
    const text = await res.text();
    const groups = parse(text);
    const specific = groups.find((g) => g.userAgent === UA.toLowerCase());
    const wildcard = groups.find((g) => g.userAgent === '*');
    const applicable = specific ?? wildcard;
    if (!applicable) return true;
    const path = url.pathname + (url.search || '');
    // Longest matching rule wins (simple approximation).
    const disallowed = applicable.disallow
      .filter((p) => matches(p, path))
      .sort((a, b) => b.length - a.length)[0];
    const allowed = applicable.allow
      .filter((p) => matches(p, path))
      .sort((a, b) => b.length - a.length)[0];
    if (!disallowed) return true;
    if (allowed && allowed.length >= disallowed.length) return true;
    return false;
  } catch {
    return true; // network blip → allow
  }
}

export async function assertRobotsAllowed(url: URL, signal?: AbortSignal): Promise<void> {
  const ok = await isAllowedByRobots(url, signal);
  if (!ok) throw new RobotsDisallowedError(url.href);
}
