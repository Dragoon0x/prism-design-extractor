/**
 * Client-side BYOK helpers. The Anthropic API key is stored in localStorage
 * only — never sent to our server except as the `X-Anthropic-Key` header of
 * the immediate extraction request, and never persisted server-side.
 */
'use client';

const STORAGE_KEY = 'prism.anthropic.apiKey';

export function getApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, key);
}

export function clearApiKey(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function isPlausibleApiKey(value: string): boolean {
  return /^sk-ant-[a-zA-Z0-9_\-]{20,}$/.test(value.trim());
}

/** Last four characters, for display in the settings UI. */
export function apiKeyPreview(key: string): string {
  if (key.length < 8) return '••••';
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}
