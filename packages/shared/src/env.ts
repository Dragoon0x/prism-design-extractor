/**
 * Runtime env-var validation — parsed once at boot, typed everywhere.
 * Fail fast: a missing required var throws a readable Zod error.
 *
 * Shape: Vercel-native stack (Neon + Upstash + QStash + Vercel Blob).
 */
import { z } from 'zod';

const booleanish = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0'])])
  .transform((v) => v === true || v === 'true' || v === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // --- Public ---
  NEXT_PUBLIC_APP_URL: z.string().url(),

  // --- Postgres (Neon / Vercel Postgres) ---
  DATABASE_URL: z.string().min(1),

  // --- Upstash Redis (SSE pub/sub + rate limiting) ---
  UPSTASH_REDIS_REST_URL: z.string().url(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1),

  // --- Upstash QStash (job queue) ---
  QSTASH_TOKEN: z.string().min(1),
  QSTASH_CURRENT_SIGNING_KEY: z.string().min(1),
  QSTASH_NEXT_SIGNING_KEY: z.string().min(1),

  // --- Vercel Blob ---
  BLOB_READ_WRITE_TOKEN: z.string().min(1),

  // --- Encryption ---
  AES_KEK: z
    .string()
    .min(1, 'AES_KEK is required — generate with `node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"`')
    .refine(
      (v) => {
        try {
          return Buffer.from(v, 'base64').length === 32;
        } catch {
          return false;
        }
      },
      { message: 'AES_KEK must be a base64 string decoding to exactly 32 bytes' },
    ),

  // --- Anthropic (optional server-side fallback) ---
  ANTHROPIC_API_KEY: z.string().optional(),

  // --- Auth ---
  ENABLE_AUTH: booleanish.default(false),
  AUTH_SECRET: z.string().optional(),
  SMTP_URL: z.string().optional(),

  // --- Timeouts (capped to Vercel Pro's 300s ceiling) ---
  EXTRACTION_URL_TIMEOUT_MS: z.coerce.number().int().positive().max(290_000).default(280_000),
  EXTRACTION_PAGE_TIMEOUT_MS: z.coerce.number().int().positive().default(28_000),
  EXTRACTION_IMAGE_TIMEOUT_MS: z.coerce.number().int().positive().default(45_000),

  // --- Rate limiting ---
  RATE_LIMIT_ANON_PER_HOUR: z.coerce.number().int().nonnegative().default(20),
  RATE_LIMIT_SIGNED_PER_HOUR: z.coerce.number().int().nonnegative().default(200),

  // --- Model defaults ---
  CLAUDE_VISION_MODEL: z.string().default('claude-sonnet-4-6'),
  CLAUDE_REASONING_MODEL: z.string().default('claude-opus-4-7'),
  CLAUDE_FAST_MODEL: z.string().default('claude-haiku-4-5-20251001'),

  // --- Observability ---
  SENTRY_DSN: z.string().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_SERVICE_NAME: z.string().default('prism'),

  // --- Abuse controls ---
  MAX_PDF_BYTES: z.coerce.number().int().positive().default(52_428_800),
  MAX_IMAGE_BYTES: z.coerce.number().int().positive().default(20_971_520),
  DOMAIN_BLOCKLIST: z.string().default(''),

  // --- Local dev ---
  LOCAL_CHROMIUM: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  cached = envSchema.parse(source);
  return cached;
}

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  return envSchema.parse(source);
}
