/**
 * Four viewport profiles Prism captures for every URL extraction.
 * Keep these stable — they're fixtures for snapshot tests and the eval harness.
 */
import type { Viewport } from '@prism/shared';

export const VIEWPORTS: readonly Viewport[] = [
  { name: 'mobile', width: 390, height: 844, deviceScaleFactor: 2 },
  { name: 'tablet', width: 820, height: 1180, deviceScaleFactor: 2 },
  { name: 'desktop', width: 1440, height: 900, deviceScaleFactor: 1 },
  { name: 'wide', width: 1920, height: 1080, deviceScaleFactor: 1 },
] as const;
