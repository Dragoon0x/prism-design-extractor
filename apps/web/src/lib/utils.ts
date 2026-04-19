import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes, de-duping conflicts (p-2 + p-4 → p-4). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Format a USD amount with up to 4 significant digits after the decimal. */
export function formatUsd(amount: number): string {
  if (amount < 0.01) return `$${amount.toFixed(4)}`;
  if (amount < 1) return `$${amount.toFixed(3)}`;
  return `$${amount.toFixed(2)}`;
}

/** Format ms → human-readable (1.2s, 850ms, 2m 15s). */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${rem}s`;
}

/** Pluralize: (1, 'token') → '1 token', (3, 'token') → '3 tokens'. */
export function plural(n: number, singular: string, pluralForm?: string): string {
  return n === 1 ? `${n} ${singular}` : `${n} ${pluralForm ?? `${singular}s`}`;
}
