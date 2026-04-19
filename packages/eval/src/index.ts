/**
 * @prism/eval — Phase 10 public surface.
 *
 * CLI: `pnpm eval` (runs `src/cli.ts` against ./fixtures).
 * Library: import the scoring functions for unit tests or custom harness runs.
 */
export {
  answerFileSchema,
  paletteAnswerSchema,
  typographyAnswerSchema,
  componentAnswerSchema,
  type AnswerFile,
  type PaletteAnswer,
  type TypographyAnswer,
  type ComponentAnswer,
} from './answer-schema.js';
export {
  scoreFixture,
  scorePalette,
  scoreTypography,
  scoreSpacing,
  scoreRadii,
  scoreComponents,
  scorePresence,
  summarizeOverall,
  type FixtureScore,
  type PrfScore,
} from './score.js';
export { loadFixtures, type FixtureBundle } from './load.js';
