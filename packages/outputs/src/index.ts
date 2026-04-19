/**
 * @prism/outputs — deterministic generators for every supported output format.
 *
 * `generate(extraction, format) → Artifact` is the single public dispatcher.
 * Every generator is pure (no I/O, no Claude) so snapshot tests are the
 * source of truth for output correctness.
 */
import type { Artifact, CanonicalExtraction, OutputFormat } from '@prism/shared';
import { generateDesignTokensJson } from './design-tokens.js';
import { generateCssVariables } from './css-variables.js';
import { generateScss } from './scss.js';
import { generateCssInJs } from './css-in-js.js';
import { generateTailwindConfig } from './tailwind.js';
import { generateDesignMdCompact, generateDesignMdExtended } from './design-md/index.js';

export * from './artifact.js';
export * from './shared.js';
export {
  generateDesignTokensJson,
  generateCssVariables,
  generateScss,
  generateCssInJs,
  generateTailwindConfig,
  generateDesignMdCompact,
  generateDesignMdExtended,
};

/** Formats implemented in Phase 4. */
export const SUPPORTED_FORMATS_V1: readonly OutputFormat[] = [
  'design-md-compact',
  'design-md-extended',
  'design-tokens-json',
  'tailwind-config',
  'css-variables',
  'scss',
  'css-in-js',
] as const;

export class UnsupportedFormatError extends Error {
  constructor(public readonly format: OutputFormat) {
    super(`Output format "${format}" is not supported yet`);
    this.name = 'UnsupportedFormatError';
  }
}

/**
 * Dispatch: produce an `Artifact` for the requested format from a canonical
 * extraction. Throws `UnsupportedFormatError` for formats scheduled in
 * later phases (Storybook, React scaffolds, Figma tokens, docs-site ZIP,
 * asset bundle, Style Dictionary config).
 */
export function generate(extraction: CanonicalExtraction, format: OutputFormat): Artifact {
  switch (format) {
    case 'design-tokens-json':
      return generateDesignTokensJson(extraction);
    case 'tailwind-config':
      return generateTailwindConfig(extraction);
    case 'css-variables':
      return generateCssVariables(extraction);
    case 'scss':
      return generateScss(extraction);
    case 'css-in-js':
      return generateCssInJs(extraction);
    case 'design-md-compact':
      return generateDesignMdCompact(extraction);
    case 'design-md-extended':
      return generateDesignMdExtended(extraction);
    case 'storybook-stories':
    case 'react-component-scaffolds':
    case 'figma-tokens-json':
    case 'style-dictionary-config':
    case 'docs-site-zip':
    case 'asset-bundle-zip':
      throw new UnsupportedFormatError(format);
    default: {
      const exhaustive: never = format;
      throw new UnsupportedFormatError(exhaustive);
    }
  }
}

/** Generate every supported format from one extraction. Useful for the `/outputs` results tab. */
export function generateAll(extraction: CanonicalExtraction): Artifact[] {
  return SUPPORTED_FORMATS_V1.map((f) => generate(extraction, f));
}
