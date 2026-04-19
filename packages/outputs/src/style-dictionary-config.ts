/**
 * A drop-in Style Dictionary v4 config pointing at Prism's `design-tokens.json`.
 *
 * With this + the generated DTCG JSON, a user can run `sd build` to fan out
 * to CSS / SCSS / JS / Android / iOS without any Prism-specific knowledge.
 */
import type { Artifact, CanonicalExtraction } from '@prism/shared';
import { jsonArtifact } from './artifact.js';

export function generateStyleDictionaryConfig(_extraction: CanonicalExtraction): Artifact {
  const config = {
    $schema: 'https://raw.githubusercontent.com/amzn/style-dictionary/main/schemas/config.schema.json',
    source: ['design-tokens.json'],
    platforms: {
      css: {
        transformGroup: 'css',
        buildPath: 'build/css/',
        files: [
          {
            destination: 'variables.css',
            format: 'css/variables',
          },
        ],
      },
      scss: {
        transformGroup: 'scss',
        buildPath: 'build/scss/',
        files: [
          {
            destination: '_variables.scss',
            format: 'scss/variables',
          },
        ],
      },
      js: {
        transformGroup: 'js',
        buildPath: 'build/js/',
        files: [
          {
            destination: 'tokens.js',
            format: 'javascript/module-flat',
          },
        ],
      },
      ios: {
        transformGroup: 'ios',
        buildPath: 'build/ios/',
        files: [
          {
            destination: 'StyleDictionary.h',
            format: 'ios/macros',
          },
          {
            destination: 'StyleDictionaryColor.h',
            format: 'ios/colors.h',
            className: 'StyleDictionaryColor',
            type: 'StyleDictionaryColorName',
            filter: { type: 'color' },
          },
        ],
      },
      android: {
        transformGroup: 'android',
        buildPath: 'build/android/',
        files: [
          {
            destination: 'colors.xml',
            format: 'android/colors',
            filter: { type: 'color' },
          },
          {
            destination: 'dimens.xml',
            format: 'android/dimens',
            filter: { type: 'dimension' },
          },
        ],
      },
    },
  };
  return jsonArtifact('style-dictionary-config', 'sd.config.json', config);
}
