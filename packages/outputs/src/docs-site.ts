/**
 * Docs-site ZIP — a single static `index.html` + `tokens.css` that renders
 * the design system as a human-friendly page. Users can drop the folder into
 * any static host (Netlify / GitHub Pages / S3) and ship documentation in
 * under a minute.
 *
 * Deliberately minimal — no JS framework, no build step. If users want a
 * richer docs site (Storybook / Docusaurus / Nextra), they have the
 * canonical design-tokens.json + generated Storybook stories to plug in.
 */
import JSZip from 'jszip';
import type { Artifact, CanonicalExtraction } from '@prism/shared';
import { bytesArtifact } from './artifact.js';
import { generateCssVariables } from './css-variables.js';
import {
  colorCss,
  keyedTokens,
  lengthCss,
  radiusCss,
  shadowCss,
  tokensByCategory,
  typographyCss,
} from './shared.js';

function htmlEscape(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderIndexHtml(extraction: CanonicalExtraction): string {
  const t = tokensByCategory(extraction);
  const sourceLabel =
    extraction.input.type === 'url' ? extraction.input.url : `${extraction.input.type} upload`;

  const colorCards = keyedTokens(t.colors)
    .map(({ key, value }) => {
      const css = colorCss(value.value);
      const light = value.value.hsl.l > 70;
      return `<li class="swatch" style="background:${css}; color:${
        light ? '#111' : '#fff'
      };"><strong>${htmlEscape(key)}</strong><code>${css}</code></li>`;
    })
    .join('\n');

  const typoCards = keyedTokens(t.typography)
    .map(({ key, value }) => {
      const v = typographyCss(value);
      return `<li class="typo" style="font-family:${v.family}; font-size:${v.size}; font-weight:${v.weight};"><div>The quick brown fox jumps over the lazy dog.</div><small>${htmlEscape(key)} — ${htmlEscape(v.family)} ${v.size}, ${v.weight}</small></li>`;
    })
    .join('\n');

  const spacingRows = keyedTokens(t.spacing)
    .map(
      ({ key, value }) =>
        `<li><div class="spacer" style="width:${lengthCss(value.value)};"></div><code>${htmlEscape(key)}</code>${lengthCss(value.value)}</li>`,
    )
    .join('\n');

  const radiusRows = keyedTokens(t.radii)
    .map(
      ({ key, value }) =>
        `<li><div class="radius" style="border-radius:${radiusCss(value)};"></div><code>${htmlEscape(key)}</code>${radiusCss(value)}</li>`,
    )
    .join('\n');

  const shadowRows = keyedTokens(t.shadows)
    .map(
      ({ key, value }) =>
        `<li><div class="shadow-sample" style="box-shadow:${shadowCss(value)};"></div><code>${htmlEscape(key)}</code></li>`,
    )
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Design system — Prism</title>
  <link rel="stylesheet" href="./tokens.css" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; color: #0a0a0a; background: #fafafa; }
    main { max-width: 1040px; margin: 0 auto; padding: 56px 24px; }
    header { margin-bottom: 48px; }
    h1 { font-size: 40px; margin: 0 0 12px; letter-spacing: -0.02em; }
    h2 { font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; color: #666; margin: 40px 0 12px; }
    section { margin-bottom: 48px; }
    ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 12px; }
    .palette { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
    .palette .swatch { display: flex; flex-direction: column; justify-content: space-between; aspect-ratio: 1; padding: 12px; border-radius: 12px; }
    .palette code { font-size: 11px; opacity: 0.7; margin-top: auto; }
    .typos { grid-template-columns: 1fr; }
    .typo { padding: 16px; border: 1px solid #eee; border-radius: 12px; background: #fff; }
    .typo small { display: block; margin-top: 8px; font-family: ui-monospace, monospace; font-size: 11px; color: #999; }
    .spacings li, .radii li, .shadows li { display: grid; grid-template-columns: 120px 180px 1fr; gap: 12px; align-items: center; padding: 10px; border-bottom: 1px solid #eee; }
    .spacer { height: 10px; background: #6366f1; border-radius: 2px; }
    .radius { width: 40px; height: 40px; background: #6366f1; }
    .shadow-sample { width: 80px; height: 40px; background: #fff; border-radius: 6px; }
    footer { margin-top: 64px; font-size: 12px; color: #999; }
    code { font-family: ui-monospace, monospace; font-size: 12px; }
    pre { background: #f4f4f4; padding: 16px; border-radius: 12px; overflow-x: auto; font-size: 12px; }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Design System</h1>
      <p>Source: <code>${htmlEscape(sourceLabel)}</code></p>
      <p>${extraction.tokens.length} tokens · ${extraction.components.length} components · ${extraction.audits.length} audits</p>
    </header>

    <section>
      <h2>Colors (${t.colors.length})</h2>
      <ul class="palette">${colorCards}</ul>
    </section>

    <section>
      <h2>Typography (${t.typography.length})</h2>
      <ul class="typos">${typoCards}</ul>
    </section>

    <section>
      <h2>Spacing (${t.spacing.length})</h2>
      <ul class="spacings">${spacingRows}</ul>
    </section>

    <section>
      <h2>Radii (${t.radii.length})</h2>
      <ul class="radii">${radiusRows}</ul>
    </section>

    <section>
      <h2>Shadows (${t.shadows.length})</h2>
      <ul class="shadows">${shadowRows}</ul>
    </section>

    <footer>Generated by <a href="https://github.com/REPLACE_ME/prism">Prism</a> · ${extraction.meta.extractedAt}</footer>
  </main>
</body>
</html>
`;
}

export async function generateDocsSite(extraction: CanonicalExtraction): Promise<Artifact> {
  const zip = new JSZip();
  zip.file('index.html', renderIndexHtml(extraction));
  const tokensCss = generateCssVariables(extraction);
  if (tokensCss.content.kind === 'text') {
    zip.file('tokens.css', tokensCss.content.text);
  }
  zip.file(
    'README.md',
    `# ${extraction.input.type === 'url' ? extraction.input.url : 'Design system'} — static docs

Drop this folder on any static host (Netlify / GitHub Pages / S3) — \`index.html\`
has no dependencies. \`tokens.css\` is also the deliverable from Prism's CSS
variables output; edit it freely.
`,
  );
  const bytes = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return bytesArtifact({
    format: 'docs-site-zip',
    filename: 'docs-site.zip',
    contentType: 'application/zip',
    bytes,
  });
}
