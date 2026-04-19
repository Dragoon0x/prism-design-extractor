/**
 * Serverless Chromium launcher.
 *
 * On Vercel, every extraction is its own function invocation — there is no
 * browser pool to reuse. We launch Chromium via `@sparticuz/chromium`, which
 * ships a Lambda-compatible build with pre-baked fonts, and close it on
 * function exit.
 *
 * Local development falls back to the host Playwright install if `LOCAL_CHROMIUM=1`.
 */
import chromium from '@sparticuz/chromium';
import { chromium as playwrightChromium, type Browser, type BrowserContext, type Page } from 'playwright-core';

export interface LaunchOptions {
  /** When true, block WebGL / canvas acceleration for smaller memory use. */
  noGraphics?: boolean;
}

/**
 * Launch a headless Chromium instance appropriate for the current environment.
 * Caller is responsible for closing the returned browser.
 */
export async function launchBrowser(opts: LaunchOptions = {}): Promise<Browser> {
  chromium.setHeadlessMode = true;
  if (opts.noGraphics !== false) {
    chromium.setGraphicsMode = false;
  }
  const executablePath =
    process.env.LOCAL_CHROMIUM === '1'
      ? undefined
      : await chromium.executablePath();
  return playwrightChromium.launch({
    args: [
      ...chromium.args,
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--hide-scrollbars',
    ],
    headless: true,
    ...(executablePath ? { executablePath } : {}),
  });
}

/**
 * Convenience: launch a browser + context + page wired together.
 * Returns a disposer that closes everything in reverse order.
 */
export async function launchSession(opts: LaunchOptions = {}): Promise<{
  browser: Browser;
  context: BrowserContext;
  page: Page;
  dispose: () => Promise<void>;
}> {
  const browser = await launchBrowser(opts);
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 PrismBot/0.1 (+https://github.com/REPLACE_ME/prism)',
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: false,
    // Block obvious tracking/auto-play. We want a quiet, inspectable page.
    bypassCSP: false,
    javaScriptEnabled: true,
    locale: 'en-US',
  });
  const page = await context.newPage();
  return {
    browser,
    context,
    page,
    dispose: async () => {
      try {
        await page.close({ runBeforeUnload: false });
      } catch {
        // already closed
      }
      try {
        await context.close();
      } catch {
        // already closed
      }
      try {
        await browser.close();
      } catch {
        // already closed
      }
    },
  };
}
