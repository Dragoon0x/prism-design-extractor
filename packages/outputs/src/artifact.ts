/**
 * Artifact envelope helpers. Every generator returns an `Artifact` so the
 * worker can uniformly upload + persist them. Content-addressed by SHA-256.
 */
import { createHash } from 'node:crypto';
import type { Artifact, OutputFormat } from '@prism/shared';

export interface TextArtifactInput {
  format: OutputFormat;
  filename: string;
  contentType: string;
  text: string;
}

export function textArtifact(input: TextArtifactInput): Artifact {
  const hash = createHash('sha256').update(input.text).digest('hex');
  return {
    format: input.format,
    filename: input.filename,
    contentType: input.contentType,
    content: { kind: 'text', text: input.text },
    hash,
    sizeBytes: Buffer.byteLength(input.text, 'utf8'),
    generatedAt: new Date().toISOString(),
  };
}

export interface BytesArtifactInput {
  format: OutputFormat;
  filename: string;
  contentType: string;
  bytes: Buffer;
}

/** Binary artifact (ZIPs, images). Worker route decodes base64 and uploads. */
export function bytesArtifact(input: BytesArtifactInput): Artifact {
  const hash = createHash('sha256').update(input.bytes).digest('hex');
  return {
    format: input.format,
    filename: input.filename,
    contentType: input.contentType,
    content: { kind: 'bytes', bytesBase64: input.bytes.toString('base64') },
    hash,
    sizeBytes: input.bytes.byteLength,
    generatedAt: new Date().toISOString(),
  };
}

/** Convenience: JSON artifact with pretty-printed content. */
export function jsonArtifact(
  format: OutputFormat,
  filename: string,
  value: unknown,
): Artifact {
  return textArtifact({
    format,
    filename,
    contentType: 'application/json',
    text: JSON.stringify(value, null, 2) + '\n',
  });
}
