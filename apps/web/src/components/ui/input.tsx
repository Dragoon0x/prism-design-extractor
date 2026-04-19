'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-11 w-full rounded-lg border border-[var(--color-border)] bg-white px-4 text-base outline-none transition focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[color-mix(in_oklch,var(--color-accent)_30%,transparent)] disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
