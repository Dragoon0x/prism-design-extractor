import type { HTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      tone: {
        neutral: 'bg-[var(--color-surface)] text-[var(--color-muted)] border border-[var(--color-border)]',
        accent: 'bg-[color-mix(in_oklch,var(--color-accent)_15%,var(--color-bg))] text-[var(--color-accent)]',
        success: 'bg-emerald-50 text-emerald-700',
        warn: 'bg-amber-50 text-amber-700',
        danger: 'bg-rose-50 text-rose-700',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
