/**
 * Structured logger with automatic redaction of sensitive values.
 *
 * Every log line goes through `redact()`; any `sk-ant-…` key or our
 * AES-GCM envelope pattern is masked before it reaches stdout or Sentry.
 * This is the safety net underneath all `console.log` calls — even a
 * stray `JSON.stringify(job)` that includes the keyEnvelope will be safe.
 */

const ANTHROPIC_KEY_PATTERN = /sk-ant-[A-Za-z0-9_\-]{16,}/g;
const KEY_ENVELOPE_PATTERN = /\b[A-Za-z0-9_\-]{12,}\.[A-Za-z0-9_\-]{24,}\.[A-Za-z0-9_\-]{12,}\b/g;

export function redact(input: unknown): string {
  const s =
    typeof input === 'string' ? input : JSON.stringify(input, replaceSensitive);
  return s.replace(ANTHROPIC_KEY_PATTERN, 'sk-ant-[REDACTED]').replace(
    KEY_ENVELOPE_PATTERN,
    '[REDACTED-ENVELOPE]',
  );
}

function replaceSensitive(key: string, value: unknown): unknown {
  const lower = key.toLowerCase();
  if (
    lower.includes('apikey') ||
    lower.includes('api_key') ||
    lower === 'authorization' ||
    lower === 'x-anthropic-key' ||
    lower === 'keyenvelope' ||
    lower === 'key_envelope' ||
    lower === 'auth_tag' ||
    lower === 'ciphertext'
  ) {
    return '[REDACTED]';
  }
  return value;
}

interface LogFields {
  [key: string]: unknown;
}

function emit(level: 'info' | 'warn' | 'error', message: string, fields?: LogFields): void {
  const payload: LogFields = {
    level,
    ts: new Date().toISOString(),
    msg: message,
    ...(fields ?? {}),
  };
  const line = redact(payload);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const log = {
  info: (message: string, fields?: LogFields) => emit('info', message, fields),
  warn: (message: string, fields?: LogFields) => emit('warn', message, fields),
  error: (message: string, fields?: LogFields) => emit('error', message, fields),
};
