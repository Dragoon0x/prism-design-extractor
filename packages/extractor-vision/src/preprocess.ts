/**
 * Image preprocessing. Every uploaded image goes through here before it reaches
 * Claude:
 *
 *   1. Decode with sharp (validates + strips EXIF implicitly).
 *   2. Resize so the longest side is ≤ 1568px (Claude's recommended max).
 *   3. Re-encode as PNG so the vision call gets a predictable format.
 *
 * Throws with a readable message on decode failure; callers translate that
 * into a `failed` stage delta.
 */
import sharp from 'sharp';

export interface PreprocessedImage {
  pngBytes: Buffer;
  widthPx: number;
  heightPx: number;
  originalFormat: string;
}

const MAX_DIMENSION = 1568;

export async function preprocessImage(inputBytes: Buffer): Promise<PreprocessedImage> {
  const pipeline = sharp(inputBytes, { failOn: 'truncated' }).rotate();
  const meta = await pipeline.metadata();
  if (!meta.width || !meta.height) {
    throw new Error('Unable to read image dimensions');
  }
  const originalFormat = meta.format ?? 'unknown';
  const longest = Math.max(meta.width, meta.height);
  const resized =
    longest > MAX_DIMENSION
      ? pipeline.resize({
          width: meta.width >= meta.height ? MAX_DIMENSION : undefined,
          height: meta.height > meta.width ? MAX_DIMENSION : undefined,
          fit: 'inside',
          withoutEnlargement: true,
        })
      : pipeline;
  const pngBytes = await resized.png({ compressionLevel: 8 }).toBuffer();
  const outMeta = await sharp(pngBytes).metadata();
  return {
    pngBytes,
    widthPx: outMeta.width ?? meta.width,
    heightPx: outMeta.height ?? meta.height,
    originalFormat,
  };
}
