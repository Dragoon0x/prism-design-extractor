/**
 * AES-256-GCM envelope for the Anthropic API key.
 *
 * Anon users send their key in the `X-Anthropic-Key` header. We encrypt it
 * immediately into a compact envelope string (`iv.ct.tag`, all base64url),
 * pass the envelope through QStash, and decrypt on the worker side.
 *
 * Rationale: the raw key never lands on disk in QStash / logs / retries.
 * TLS already protects in transit; this protects at rest.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from './env.js';

function loadKek(): Buffer {
  const buf = Buffer.from(env.AES_KEK, 'base64');
  if (buf.length !== 32) throw new Error('AES_KEK must decode to 32 bytes');
  return buf;
}

export function sealKey(plaintext: string): string {
  if (!plaintext) throw new Error('sealKey: plaintext is empty');
  const kek = loadKek();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', kek, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('base64url'), ct.toString('base64url'), tag.toString('base64url')].join('.');
}

export function openKey(envelope: string): string {
  const [ivB64, ctB64, tagB64] = envelope.split('.');
  if (!ivB64 || !ctB64 || !tagB64) throw new Error('openKey: malformed envelope');
  const kek = loadKek();
  const decipher = createDecipheriv('aes-256-gcm', kek, Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(ctB64, 'base64url')),
    decipher.final(),
  ]);
  return pt.toString('utf8');
}
