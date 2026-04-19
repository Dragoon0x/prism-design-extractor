/**
 * Synthesize a seed set of fixture images programmatically.
 *
 * Usage: `pnpm --filter @prism/eval run synthesize [target-dir]`
 *   default target: ./fixtures
 *
 * Creates 3 minimal but realistic design-system screenshots with matching
 * answer JSONs. Users can drop in their own PNG + JSON pairs alongside these
 * to grow the fixture suite toward the 30-50 the plan targets.
 *
 * These synth fixtures aren't a substitute for real captured screenshots —
 * they're a smoke test that the harness + scoring work end-to-end.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createCanvas, type SKRSContext2D } from '@napi-rs/canvas';
import type { AnswerFile } from './answer-schema.js';

interface SynthFixture {
  id: string;
  description: string;
  render: (ctx: SKRSContext2D) => void;
  width: number;
  height: number;
  answer: Omit<AnswerFile, 'id' | 'description'>;
}

const fixtures: SynthFixture[] = [
  {
    id: 'synth-01-palette',
    description: '4-swatch palette on white with labels.',
    width: 800,
    height: 400,
    render: (ctx) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 800, 400);
      const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b'];
      const gap = 24;
      const swatchW = (800 - gap * 5) / 4;
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = colors[i]!;
        ctx.fillRect(gap + i * (swatchW + gap), 80, swatchW, 240);
      }
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 36px sans-serif';
      ctx.fillText('Brand Palette', 24, 48);
    },
    answer: {
      palette: [
        { hex: '#ffffff', label: 'background' },
        { hex: '#0f172a', label: 'foreground' },
        { hex: '#3b82f6', label: 'primary' },
        { hex: '#ef4444', label: 'destructive' },
        { hex: '#10b981', label: 'success' },
        { hex: '#f59e0b', label: 'warning' },
      ],
      typography: [
        { role: 'display', familyCandidates: ['sans-serif', 'Inter', 'Helvetica', 'Arial'], sizePx: 36, sizeToleranceAbsPx: 6, weight: 700, weightTolerance: 200 },
      ],
      spacingPx: [],
      radiiPx: [],
      components: [],
      hasGradient: false,
      hasShadow: false,
    },
  },
  {
    id: 'synth-02-card',
    description: 'A single card with rounded corners and a soft shadow.',
    width: 800,
    height: 600,
    render: (ctx) => {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 800, 600);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(15, 23, 42, 0.12)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 8;
      roundedRect(ctx, 120, 120, 560, 360, 16);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText('Welcome back', 160, 200);
      ctx.fillStyle = '#475569';
      ctx.font = '16px sans-serif';
      ctx.fillText('Sign in to continue to your dashboard.', 160, 240);
      ctx.fillStyle = '#3b82f6';
      roundedRect(ctx, 160, 400, 160, 48, 8);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 16px sans-serif';
      ctx.fillText('Sign in', 210, 430);
    },
    answer: {
      palette: [
        { hex: '#f8fafc', label: 'background' },
        { hex: '#ffffff', label: 'surface' },
        { hex: '#0f172a', label: 'foreground' },
        { hex: '#475569', label: 'muted-foreground' },
        { hex: '#3b82f6', label: 'primary' },
      ],
      typography: [
        { role: 'heading-1', familyCandidates: ['sans-serif', 'Inter'], sizePx: 32, sizeToleranceAbsPx: 6, weight: 700, weightTolerance: 200 },
        { role: 'body', familyCandidates: ['sans-serif', 'Inter'], sizePx: 16, sizeToleranceAbsPx: 4, weightTolerance: 100 },
        { role: 'button', familyCandidates: ['sans-serif', 'Inter'], sizePx: 16, sizeToleranceAbsPx: 4, weight: 600, weightTolerance: 150 },
      ],
      spacingPx: [],
      radiiPx: [8, 16],
      components: [{ kind: 'card' }, { kind: 'button' }],
      hasGradient: false,
      hasShadow: true,
    },
  },
  {
    id: 'synth-03-gradient-hero',
    description: 'A vertical linear gradient hero with white heading text.',
    width: 1200,
    height: 600,
    render: (ctx) => {
      const grad = ctx.createLinearGradient(0, 0, 0, 600);
      grad.addColorStop(0, '#6366f1');
      grad.addColorStop(1, '#ec4899');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1200, 600);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 72px sans-serif';
      ctx.fillText('Build something new', 120, 260);
      ctx.font = '24px sans-serif';
      ctx.fillText('Prism extracts design systems from any source.', 120, 320);
      ctx.fillStyle = '#ffffff';
      roundedRect(ctx, 120, 420, 220, 56, 28);
      ctx.fill();
      ctx.fillStyle = '#6366f1';
      ctx.font = '600 18px sans-serif';
      ctx.fillText('Get started', 190, 456);
    },
    answer: {
      palette: [
        { hex: '#ffffff', label: 'foreground-on-gradient' },
        { hex: '#6366f1', label: 'primary' },
        { hex: '#ec4899', label: 'accent' },
      ],
      typography: [
        { role: 'display', familyCandidates: ['sans-serif', 'Inter'], sizePx: 72, sizeToleranceAbsPx: 12, weight: 700, weightTolerance: 200 },
        { role: 'subtitle', familyCandidates: ['sans-serif', 'Inter'], sizePx: 24, sizeToleranceAbsPx: 6, weightTolerance: 100 },
      ],
      spacingPx: [],
      radiiPx: [28],
      components: [{ kind: 'button', variantHint: 'primary' }, { kind: 'hero' }],
      hasGradient: true,
      hasShadow: false,
    },
  },
];

function roundedRect(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

async function main(): Promise<void> {
  const root = resolve(process.argv[2] ?? resolve(process.cwd(), 'fixtures'));
  const imagesDir = resolve(root, 'images');
  const answersDir = resolve(root, 'answers');
  await mkdir(imagesDir, { recursive: true });
  await mkdir(answersDir, { recursive: true });

  for (const fixture of fixtures) {
    const canvas = createCanvas(fixture.width, fixture.height);
    const ctx = canvas.getContext('2d');
    fixture.render(ctx);
    const pngBytes = await canvas.encode('png');
    await writeFile(resolve(imagesDir, `${fixture.id}.png`), pngBytes);
    const answer: AnswerFile = {
      id: fixture.id,
      description: fixture.description,
      ...fixture.answer,
    } as AnswerFile;
    await writeFile(
      resolve(answersDir, `${fixture.id}.json`),
      JSON.stringify(answer, null, 2) + '\n',
    );
    console.error(`[synth] ${fixture.id} (${fixture.width}×${fixture.height}px)`);
  }
  console.error(`[synth] wrote ${fixtures.length} fixtures to ${root}`);
}

void main().catch((err) => {
  console.error('[synth] failed:', err);
  process.exit(1);
});
