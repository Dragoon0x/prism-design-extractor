/**
 * PDF → per-page PNG rendering.
 *
 * Uses pdfjs-dist's legacy ESM build (Node-compatible) with a custom canvas
 * factory backed by `@napi-rs/canvas` — pure-JS Canvas 2D that works in Vercel
 * serverless functions (no native node-canvas build headaches).
 *
 * Called from the PDF pipeline entry point; each rendered page is uploaded to
 * Vercel Blob before we enqueue the per-page worker that consumes it.
 */
import { createCanvas, type Canvas, type SKRSContext2D } from '@napi-rs/canvas';
import type {
  DocumentInitParameters,
  PDFDocumentProxy,
} from 'pdfjs-dist/types/src/display/api.js';

/**
 * Minimal canvas factory satisfying pdfjs-dist's internal contract.
 * Shape must match `{ create, reset, destroy }`.
 */
class NapiCanvasFactory {
  create(width: number, height: number): { canvas: Canvas; context: SKRSContext2D } {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    return { canvas, context };
  }
  reset(
    canvasAndContext: { canvas: Canvas; context: SKRSContext2D },
    width: number,
    height: number,
  ): void {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }
  destroy(canvasAndContext: { canvas: Canvas; context: SKRSContext2D }): void {
    canvasAndContext.canvas.width = 0;
    canvasAndContext.canvas.height = 0;
    (canvasAndContext as unknown as { canvas: unknown; context: unknown }).canvas = null;
    (canvasAndContext as unknown as { canvas: unknown; context: unknown }).context = null;
  }
}

export interface RenderedPage {
  pageNumber: number;
  widthPx: number;
  heightPx: number;
  pngBytes: Buffer;
}

export interface RenderPdfOptions {
  /** Render scale factor. 2 = retina; 1 = 1x. Default 2. */
  scale?: number;
  /** Cap pages rendered. Default 30. */
  maxPages?: number;
}

/**
 * Load a PDF from raw bytes and render each page to a PNG buffer.
 * Yields pages sequentially; callers should `for await` and upload each as it arrives.
 */
export async function* renderPdfPages(
  pdfBytes: Uint8Array,
  options: RenderPdfOptions = {},
): AsyncGenerator<RenderedPage, void, unknown> {
  const scale = options.scale ?? 2;
  const maxPages = options.maxPages ?? 30;

  // Dynamic import — pdfjs-dist's legacy build is the Node-safe entry point.
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const getDocument = pdfjs.getDocument as (
    src: DocumentInitParameters,
  ) => { promise: Promise<PDFDocumentProxy> };

  const loadingTask = getDocument({
    data: pdfBytes,
    disableFontFace: true,
    useSystemFonts: false,
    isEvalSupported: false,
    CanvasFactory: NapiCanvasFactory as unknown as DocumentInitParameters['CanvasFactory'],
  });
  const doc = await loadingTask.promise;

  const pageCount = Math.min(doc.numPages, maxPages);

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const width = Math.ceil(viewport.width);
    const height = Math.ceil(viewport.height);
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');

    await page.render({
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;

    const pngBytes = await canvas.encode('png');

    yield { pageNumber, widthPx: width, heightPx: height, pngBytes: Buffer.from(pngBytes) };

    page.cleanup();
  }

  await doc.cleanup();
  await doc.destroy();
}

/** Returns just the page count without rendering. Used for UI progress estimates. */
export async function getPdfPageCount(pdfBytes: Uint8Array): Promise<number> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const getDocument = pdfjs.getDocument as (
    src: DocumentInitParameters,
  ) => { promise: Promise<PDFDocumentProxy> };
  const doc = await getDocument({
    data: pdfBytes,
    disableFontFace: true,
    useSystemFonts: false,
    isEvalSupported: false,
  }).promise;
  const n = doc.numPages;
  await doc.destroy();
  return n;
}
