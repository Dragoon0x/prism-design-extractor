# Prism fixtures

Known-answer inputs used by unit tests and the vision eval harness (`pnpm eval`).

## Layout

```
fixtures/
├── images/              PNG / JPG / WEBP screenshots. One file per fixture; filename is the fixture id.
├── answers/             <id>.json answer files. Schema lives in `packages/eval/src/answer-schema.ts`.
├── sites/               Optional: self-hosted HTML pages used by integration tests (Phase 2+).
├── canonical/           Optional: fixture canonical trees used by output snapshot tests.
└── pdfs/                Optional: PDFs for the PDF-pipeline eval (Phase 7+).
```

## Bootstrapping

Generate three synthetic fixtures to prove the harness end-to-end:

```bash
pnpm --filter @prism/eval run synthesize
```

This writes:
- `fixtures/images/synth-01-palette.png`
- `fixtures/images/synth-02-card.png`
- `fixtures/images/synth-03-gradient-hero.png`
- Matching `<id>.json` answers in `fixtures/answers/`.

Run the harness:

```bash
ANTHROPIC_API_KEY=sk-ant-... pnpm eval
```

Passes if overall **F1 ≥ 0.80** across all fixtures. Override the threshold with `PRISM_F1_THRESHOLD=0.75 pnpm eval`. Write a JSON report with `PRISM_EVAL_REPORT=./report.json`.

## Answer schema

Each `fixtures/answers/<id>.json` must match the Zod schema in [`packages/eval/src/answer-schema.ts`](../packages/eval/src/answer-schema.ts). Shape:

```jsonc
{
  "id": "stripe-home",
  "description": "stripe.com homepage hero screenshot, 1440×900.",
  "palette": [
    { "hex": "#635bff", "label": "primary" },
    { "hex": "#0a2540", "label": "foreground" }
    // ...8-16 core colors
  ],
  "typography": [
    {
      "role": "display",
      "familyCandidates": ["Camphor", "Helvetica Neue", "sans-serif"],
      "sizePx": 56,
      "sizeToleranceAbsPx": 6,
      "weight": 600,
      "weightTolerance": 150
    }
  ],
  "spacingPx": [8, 16, 24, 32],
  "radiiPx": [4, 8],
  "components": [{ "kind": "button", "variantHint": "primary" }, { "kind": "nav" }],
  "hasGradient": false,
  "hasShadow": true
}
```

Guidance:
- **Palette**: 8–16 representative colors. Vision is scored with ΔE2000 < 5 by default; lower the threshold per entry for strict matches.
- **Typography**: list the families you'd accept as a match. Vision often sees "Helvetica Neue" where a designer intended "Inter" — be generous with the candidate list.
- **Components**: score is coarse (kind-level match only for now). Variant hints are carried through for the report but don't affect the score.
- **hasGradient / hasShadow**: flags show up in the report's `presence` section. Not currently in the overall F1 but worth tracking.

## Growing the suite

The plan targets **30–50** fixtures across the major design-system archetypes:
- Clean marketing pages (Stripe, Linear, Notion, Vercel)
- Product dashboards (Supabase, Airtable)
- Ecom (Shopify store, Apple)
- Content-heavy (NYT, Medium, Figma blog)
- Brand guideline PDFs
- Dribbble-style concept shots

Add an image + answer pair, run the harness, iterate on the answer until F1 stabilizes. Commit everything together.

## Adding a canonical fixture for output snapshots

`packages/outputs/src/fixture.ts` has a hand-built `CanonicalExtraction` used by the output-format tests. To regenerate it from a real extraction, run against a URL locally and drop the resulting canonical JSON into `fixtures/canonical/`.

## License

Fixture images must be ones we have the right to redistribute — our own captures, generated art, or synthesized imagery. Never commit scraped competitor assets.
