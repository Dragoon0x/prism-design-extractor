import Link from 'next/link';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { DisclaimerNotice } from '@/components/disclaimer-notice';

export default function AboutPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-12">
      <header>
        <span className="font-mono text-[11px] uppercase tracking-widest text-[var(--color-muted)]">
          about
        </span>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Prism</h1>
        <p className="mt-2 text-[var(--color-muted)]">
          A design-system extractor that reads URLs, screenshots, and PDFs and emits thirteen
          production-ready artifacts — with a confidence score and an evidence trail on every
          token.
        </p>
      </header>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold">How it works</h2>
        </CardHeader>
        <CardBody className="space-y-3 text-sm text-[var(--color-muted)]">
          <p>
            <strong className="text-[var(--color-fg)]">1. Capture.</strong> URLs are rendered
            across four viewports by Playwright on a serverless Chromium. Screenshots are
            preprocessed with Sharp. PDFs are split page-by-page via pdfjs.
          </p>
          <p>
            <strong className="text-[var(--color-fg)]">2. Extract.</strong> Claude vision
            (Sonnet 4.6) inspects every image for palette, typography, spacing, shadows,
            gradients, and components. URL extractions fuse this with computed-style data from
            the DOM.
          </p>
          <p>
            <strong className="text-[var(--color-fg)]">3. Cluster.</strong> Perceptual color
            clustering (ΔE2000), spacing-scale detection, and typography role grouping collapse
            hundreds of raw values into a clean design system.
          </p>
          <p>
            <strong className="text-[var(--color-fg)]">4. Name + audit.</strong> Claude Opus
            4.7 assigns semantic roles (primary / surface / destructive). Deterministic audits
            flag contrast failures, magic values, inconsistent radii.
          </p>
          <p>
            <strong className="text-[var(--color-fg)]">5. Emit.</strong> Thirteen artifacts
            from one canonical tree: DESIGN.md (compact + extended), W3C DTCG design tokens,
            Tailwind / CSS / SCSS / CSS-in-JS, Figma Tokens Studio, Style Dictionary config,
            Storybook stories, React scaffolds, asset bundle, static docs site.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold">BYOK</h2>
        </CardHeader>
        <CardBody className="text-sm text-[var(--color-muted)]">
          <p>
            Every extraction runs on <strong>your</strong> Anthropic API key. The hosted demo
            holds no API budget — it passes every request through to your key. The key itself
            stays in your browser&apos;s <code>localStorage</code>, sent once per extraction as
            the <code>X-Anthropic-Key</code> header, never stored server-side.
          </p>
          <p className="mt-2">
            <Link className="underline" href="/settings">
              Manage your key in Settings
            </Link>
            .
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold">Open source</h2>
        </CardHeader>
        <CardBody className="text-sm text-[var(--color-muted)]">
          Prism is MIT-licensed. The repo contains everything — the schema, every extractor,
          every output generator, the intelligence layer, the eval harness. Deploy your own
          instance to Vercel with the button in the README, or self-host by pointing the env
          vars at any Postgres + Redis + S3-compatible setup.
        </CardBody>
      </Card>

      <DisclaimerNotice variant="card" />
    </main>
  );
}
