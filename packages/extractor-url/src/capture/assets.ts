/**
 * Asset manifest capture. Attach a request interceptor that logs every
 * font / image / SVG / stylesheet the page pulls. We keep URL + content-type
 * + byte count + hash so downstream stages can dedupe and fetch assets we
 * want to catalog.
 */
import { createHash } from 'node:crypto';
import type { Page, Request } from 'playwright-core';

export interface AssetRecord {
  url: string;
  resourceType: string;
  contentType: string;
  bytes: number;
  sha256: string;
  from: 'image' | 'font' | 'stylesheet' | 'svg' | 'favicon' | 'other';
  status: number;
}

/**
 * Install a listener that collects assets throughout the page's lifetime.
 * The returned `getAssets()` function can be called any time — typically after
 * `page.waitForLoadState('networkidle')` to capture lazy fonts.
 */
export function installAssetCollector(page: Page): { getAssets: () => AssetRecord[] } {
  const assets: AssetRecord[] = [];
  const seen = new Set<string>();

  page.on('response', async (response) => {
    try {
      const request: Request = response.request();
      const url = request.url();
      if (seen.has(url)) return;
      const resourceType = request.resourceType();
      if (!['image', 'font', 'stylesheet', 'other'].includes(resourceType)) return;

      const contentType = response.headers()['content-type']?.split(';')[0]?.trim() ?? '';
      const body = await response.body().catch(() => Buffer.alloc(0));
      if (body.length === 0) return;
      seen.add(url);

      let from: AssetRecord['from'] = 'other';
      if (resourceType === 'image') from = 'image';
      else if (resourceType === 'font') from = 'font';
      else if (resourceType === 'stylesheet') from = 'stylesheet';
      if (contentType.includes('svg')) from = 'svg';
      if (url.includes('favicon')) from = 'favicon';

      assets.push({
        url,
        resourceType,
        contentType,
        bytes: body.length,
        sha256: createHash('sha256').update(body).digest('hex'),
        from,
        status: response.status(),
      });
    } catch {
      // best-effort; don't crash extraction on a single asset failure
    }
  });

  return { getAssets: () => assets };
}
