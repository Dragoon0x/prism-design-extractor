# Contributing to Prism

Thanks for your interest. Prism is built in the open and welcomes contributions — from typo fixes to whole output-format generators.

## Ground rules

1. **Respect the architecture boundaries.** Extractors emit tokens into the canonical tree only — they never generate outputs, never call Claude for naming, and never touch the DB. Only `@prism/intelligence` may mutate `token.semanticRole` or `token.confidence`. These boundaries are what keep the system testable.
2. **Evidence is mandatory.** Every token appended to the canonical tree must carry at least one `EvidenceItem`. No exceptions. A token with no evidence is a bug.
3. **Eval harness must stay green.** If you touch anything in the vision pipeline, run `pnpm eval` locally and confirm F1 ≥ 0.80 before opening a PR.
4. **Zod at every boundary.** Schemas in `@prism/shared` are the single source of truth. Don't add ad-hoc types.
5. **No secrets in logs.** Fuzz tests will catch it but please be deliberate when adding new log lines.

## Local development

```bash
cp .env.example .env
# generate AES_KEK:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

make install     # pnpm install + Playwright browsers
make dev         # boot Docker services + web + worker
```

Prism requires Node 22 and pnpm 9.

## Running tests

```bash
make typecheck         # strict TS across the monorepo
make test              # unit + integration
pnpm --filter @prism/web test:e2e   # Playwright E2E
pnpm eval              # vision accuracy harness
```

## Commit / PR expectations

- One focused change per PR. Big refactors: open an issue first to agree scope.
- Keep commits squashable. A PR should land as one clean commit on main.
- All checks must pass in CI: typecheck, lint, unit + integration tests, eval F1 ≥ 0.80.
- Include a short "why" in the PR description — not a retelling of the diff.

## Adding a new output format

1. Add the format id to `packages/shared/src/schemas/output-formats.ts`.
2. Implement the generator in `packages/outputs/src/<name>.ts`. It must be deterministic — no LLM calls, no network.
3. Dispatch it from `packages/outputs/src/index.ts`.
4. Add a snapshot test using a fixture canonical tree in `fixtures/canonical/`.
5. Document the format in `docs/outputs/`.

## Adding a new input type

Input types are rare and invasive. Open an issue first.

## License

MIT. By contributing, you agree your contributions are licensed under MIT.
