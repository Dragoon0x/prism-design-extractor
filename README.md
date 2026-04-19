# Prism

> Extract a complete design system from any URL, screenshot, or PDF.
> Open-source. BYOK. 13 output formats from one canonical token tree.
> Runs entirely on Vercel.

Prism analyses a website, image, or PDF and emits a full design system — tokens, components, assets, audits — with Claude vision + reasoning on every extraction. Every extracted token carries a confidence score and an evidence trail linking it to the pixel and selector it came from.

## ⚠️ Disclaimer — educational & experimental use only

**Prism is an experimental research project distributed "AS IS" for educational and experimental purposes only.** Outputs are AI-generated (Claude vision + reasoning) and can be wrong — palettes may miss colors, typography detection may substitute families, audit findings are suggestions not verdicts. **Always do your own research (DYOR) before using Prism's output in production.** The authors, contributors, and project take **no responsibility and no liability** for any damage, loss, cost, or consequence arising from use of this software, its outputs, or the hosted demo. You alone are responsible for your Anthropic API billing (BYOK), the legal right to extract your inputs (copyright, ToS, robots.txt), and any decisions or code derived from the output. Not affiliated with Anthropic, Vercel, Neon, Upstash, or any brand whose site you extract.

See the full [`DISCLAIMER.md`](./DISCLAIMER.md) for the complete terms.

## Status

🚧 Early development (v1 in progress). URL, screenshot, and PDF pipelines all live.

## Highlights

- **Three input types** — URLs (Playwright on serverless Chromium), screenshots (Claude vision), PDFs (per-page fan-out via QStash).
- **Vision + reasoning on every extraction** — Sonnet 4.6 extracts, Opus 4.7 names + audits, Haiku 4.5 for trivia.
- **Eleven output formats** from one canonical tree.
- **Evidence trail** — every token links to a screenshot crop, DOM selector, and computed-style snapshot.
- **Confidence scoring** — every token carries a 0–1 confidence.
- **Consistency audits** — duplicate-token collapse, orphan flags, WCAG contrast matrix, axe-core a11y.
- **Streaming UI** — SSE from Upstash Redis pub/sub. Palette swatches appear first, components last.
- **Fully open source (MIT)**.
- **BYOK** — users bring their own Anthropic API key. We never hold API-cost liability.

## Architecture

Pure Vercel. No long-running processes.

```
 ┌──────────────────┐          ┌──────────────────┐          ┌──────────────────┐
 │   Browser (UI)   │──POST───▶│   /api/extract   │──QStash─▶│ /api/worker/     │
 └──────────────────┘          └──────────────────┘          │    extract       │
         ▲                              │                    └────────┬─────────┘
         │  SSE                         │ 202                          │
         │                              ▼                              ▼
 ┌──────────────────┐          ┌──────────────────┐          ┌──────────────────┐
 │ /api/stream/[id] │◀─pub/sub─│  Upstash Redis   │◀─deltas──│ @prism/extractor │
 └──────────────────┘          └──────────────────┘          │      -url        │
                                                             │  (Playwright +   │
                                                             │  @sparticuz/     │
                                                             │  chromium +      │
                                                             │  Claude vision)  │
                                                             └──────────────────┘
```

- **Compute**: Vercel functions (Next.js 15 App Router). Pro plan for the 300-second worker timeout.
- **Queue**: [QStash](https://upstash.com/docs/qstash/overall/getstarted) (HTTP callbacks — no long-running workers).
- **DB**: [Neon](https://neon.tech/) (Drizzle ORM, HTTP driver).
- **Redis**: [Upstash Redis](https://upstash.com/) (pub/sub for SSE + rate limiting).
- **Browser**: [`@sparticuz/chromium`](https://github.com/Sparticuz/chromium) + `playwright-core` launched per-invocation.
- **Storage**: [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) (screenshots, PDFs, generated artifacts).

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FREPLACE_ME%2Fprism&project-name=prism&repository-name=prism&env=AES_KEK%2CNEXT_PUBLIC_APP_URL&envDescription=AES_KEK%20is%20a%20base64-encoded%20random%2032-byte%20key%20used%20to%20encrypt%20BYOK%20envelopes.%20NEXT_PUBLIC_APP_URL%20is%20your%20Vercel%20domain%20once%20the%20project%20is%20created.)

One-time setup:

1. **Fork** and click the **Deploy** button above.
2. In Vercel project settings, connect:
   - [Upstash Redis](https://vercel.com/integrations/upstash) integration (auto-provisions `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`).
   - [Upstash QStash](https://upstash.com/docs/qstash/overall/getstarted) integration (provides `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`).
   - [Neon](https://vercel.com/integrations/neon) integration (provides `DATABASE_URL`).
   - **Vercel Blob** — enable from Storage tab (provides `BLOB_READ_WRITE_TOKEN`).
3. Generate `AES_KEK`:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
   Paste into Vercel project env as `AES_KEK`.
4. Set `NEXT_PUBLIC_APP_URL=https://<your-vercel-domain>`.
5. Run migrations: `pnpm db:migrate` (pointed at your Neon `DATABASE_URL`).
6. Deploy. Open the site. Paste your Anthropic API key. Extract.

## Local development

```bash
git clone https://github.com/REPLACE_ME/prism.git
cd prism
cp .env.example .env.local
# fill in Upstash/QStash/Neon creds (free tiers are plenty)

pnpm install
pnpm db:migrate
pnpm dev
```

For local Chromium, either:
- Install Playwright browsers and set `LOCAL_CHROMIUM=1` (recommended for dev).
- Or leave unset — `@sparticuz/chromium` works locally too, just with the Lambda-flavored binary.

## Project layout

```
apps/
  web/                        Next.js 15 app (UI + /api + SSE + QStash workers)
packages/
  shared/                     Zod schemas, types, env
  db/                         Drizzle schema + Neon client
  queue/                      QStash producers + Upstash pub/sub
  claude/                     Anthropic client (caching, routing, tool-use)
  browser/                    Serverless Chromium launcher + SSRF guard + robots
  extractor-url/              URL → canonical (DOM + computed styles + vision)
  extractor-vision/           image → canonical (Phase 6)
  extractor-pdf/              PDF → canonical via page fan-out (Phase 7)
  tokens/                     Clustering, confidence, DTCG, color math
  intelligence/               Semantic naming + audits + diff (Phase 8)
  outputs/                    11 format generators (Phases 4 & 9)
  evidence/                   Crops, selectors, evidence linkage
  eval/                       Vision accuracy harness (Phase 10)
fixtures/                     Known-answer inputs
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Before opening a PR run:

```bash
pnpm typecheck
pnpm test
pnpm eval   # once the fixture suite lands in Phase 10
```

## License

[MIT](./LICENSE) — fully open source, forever.
