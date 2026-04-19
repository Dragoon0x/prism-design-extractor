'use client';

import { useMemo, useState } from 'react';
import type {
  ColorToken,
  RadiusToken,
  ShadowToken,
  SpacingToken,
  Token,
  TypographyToken,
} from '@prism/shared';
import { cn } from '@/lib/utils';
import { EvidenceDrawer } from './evidence-drawer';

export function TokenGallery({ tokens }: { tokens: Token[] }) {
  const grouped = useMemo(() => groupTokens(tokens), [tokens]);
  const [selected, setSelected] = useState<Token | null>(null);

  return (
    <div className="space-y-8">
      {grouped.colors.length > 0 && (
        <Section label="Colors" count={grouped.colors.length}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
            {grouped.colors.map((c) => (
              <ColorSwatch key={c.id} token={c} onSelect={() => setSelected(c)} />
            ))}
          </div>
        </Section>
      )}

      {grouped.typography.length > 0 && (
        <Section label="Typography" count={grouped.typography.length}>
          <div className="space-y-3">
            {grouped.typography.map((t) => (
              <TypographyCard key={t.id} token={t} onSelect={() => setSelected(t)} />
            ))}
          </div>
        </Section>
      )}

      {grouped.spacing.length > 0 && (
        <Section label="Spacing" count={grouped.spacing.length}>
          <div className="flex flex-wrap gap-2">
            {grouped.spacing.map((s) => (
              <SpacingChip key={s.id} token={s} onSelect={() => setSelected(s)} />
            ))}
          </div>
        </Section>
      )}

      {grouped.radii.length > 0 && (
        <Section label="Radii" count={grouped.radii.length}>
          <div className="flex flex-wrap gap-3">
            {grouped.radii.map((r) => (
              <RadiusCard key={r.id} token={r} onSelect={() => setSelected(r)} />
            ))}
          </div>
        </Section>
      )}

      {grouped.shadows.length > 0 && (
        <Section label="Shadows" count={grouped.shadows.length}>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {grouped.shadows.map((s) => (
              <ShadowCard key={s.id} token={s} onSelect={() => setSelected(s)} />
            ))}
          </div>
        </Section>
      )}

      <EvidenceDrawer token={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function Section({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--color-muted)]">
          {label}
        </h3>
        <span className="text-xs text-[var(--color-muted)]">{count}</span>
      </div>
      {children}
    </section>
  );
}

function ColorSwatch({ token, onSelect }: { token: ColorToken; onSelect: () => void }) {
  const hex = token.value.hex;
  const alpha = token.value.alpha;
  const isLight = token.value.hsl.l > 70;
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex flex-col items-stretch gap-1.5 rounded-xl p-1 text-left transition hover:-translate-y-0.5"
    >
      <div
        className={cn(
          'relative aspect-square w-full rounded-lg border',
          isLight ? 'border-[var(--color-border)]' : 'border-transparent',
        )}
        style={{ backgroundColor: alpha === 1 ? hex : `${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}` }}
      >
        <span className="absolute bottom-1 left-1 rounded bg-white/70 px-1 font-mono text-[10px] text-slate-800 opacity-0 transition group-hover:opacity-100">
          {token.usageCount}×
        </span>
      </div>
      <div className="px-0.5">
        <div className="truncate font-mono text-xs">{hex}</div>
        <div className="truncate text-[10px] text-[var(--color-muted)]">
          {token.semanticRole ?? token.name}
        </div>
      </div>
    </button>
  );
}

function TypographyCard({
  token,
  onSelect,
}: {
  token: TypographyToken;
  onSelect: () => void;
}) {
  const v = token.value;
  const family = [v.family, ...v.fallbackStack].join(', ');
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-xl border border-[var(--color-border)] bg-white p-4 text-left transition hover:border-[var(--color-accent)]"
    >
      <div
        style={{
          fontFamily: family,
          fontSize: `${v.size.px}px`,
          fontWeight: v.weight,
          lineHeight:
            v.lineHeight?.kind === 'unitless'
              ? v.lineHeight.value
              : v.lineHeight?.kind === 'length'
                ? `${v.lineHeight.value.px}px`
                : undefined,
        }}
      >
        The quick brown fox
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-[var(--color-muted)]">
        <span className="font-mono">
          {v.family} · {v.size.px}px · {v.weight}
        </span>
        <span>{token.usageCount}×</span>
      </div>
    </button>
  );
}

function SpacingChip({ token, onSelect }: { token: SpacingToken; onSelect: () => void }) {
  const px = token.value.px ?? token.value.value;
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm transition hover:border-[var(--color-accent)]"
    >
      <div
        className="rounded bg-[var(--color-accent)]"
        style={{ width: Math.min(px, 48), height: 8 }}
      />
      <span className="font-mono tabular-nums">{px}px</span>
      {token.spacingRole === 'scale-step' && token.scaleMultiple !== undefined && (
        <span className="text-[10px] text-[var(--color-muted)]">{token.scaleMultiple}×</span>
      )}
    </button>
  );
}

function RadiusCard({ token, onSelect }: { token: RadiusToken; onSelect: () => void }) {
  const v = token.value;
  const px = 'kind' in v ? 16 : (v.px ?? v.value);
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex flex-col items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-white p-3 transition hover:border-[var(--color-accent)]"
    >
      <div
        className="h-10 w-10 bg-[var(--color-accent)]"
        style={{ borderRadius: `${Math.min(px, 20)}px` }}
      />
      <span className="font-mono text-xs tabular-nums">{px}px</span>
    </button>
  );
}

function ShadowCard({ token, onSelect }: { token: ShadowToken; onSelect: () => void }) {
  const raw = token.evidence[0]?.rawText ?? '0 1px 2px rgba(0,0,0,0.1)';
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex flex-col items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white p-4 transition hover:border-[var(--color-accent)]"
    >
      <div className="h-10 w-10 rounded-lg bg-white" style={{ boxShadow: raw }} />
      <div className="truncate font-mono text-[10px] text-[var(--color-muted)]">{raw}</div>
    </button>
  );
}

function groupTokens(tokens: Token[]) {
  return {
    colors: tokens.filter((t): t is ColorToken => t.category === 'color'),
    typography: tokens.filter((t): t is TypographyToken => t.category === 'typography'),
    spacing: tokens.filter((t): t is SpacingToken => t.category === 'spacing'),
    radii: tokens.filter((t): t is RadiusToken => t.category === 'radius'),
    shadows: tokens.filter((t): t is ShadowToken => t.category === 'shadow'),
  };
}
