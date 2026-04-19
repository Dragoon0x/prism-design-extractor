/**
 * Postgres schema for Prism.
 *
 * Design principles:
 *   - `canonical_tree_jsonb` on `extractions` is the write-optimized single source
 *     of truth. Output generators only read from it.
 *   - Normalized tables (`tokens`, `components`, `assets`, `audits`,
 *     `evidence_items`) exist for querying, diffing, and evidence drill-down.
 *     They are populated after the canonical tree is finalized.
 *   - `api_keys_encrypted` stores AES-256-GCM ciphertexts only. Plaintext never
 *     touches the database.
 *   - GIN index on the jsonb tree for fast filtered reads.
 */
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  assetKindEnum,
  auditKindEnum,
  auditSeverityEnum,
  componentKindEnum,
  extractionStatusEnum,
  inputTypeEnum,
  pdfPageStatusEnum,
  tokenCategoryEnum,
  visibilityEnum,
} from './enums.js';

// ---------------------------------------------------------------------------
// Users (optional — anonymous by default, populated only if auth enabled)
// ---------------------------------------------------------------------------

export const users = pgTable(
  'users',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    email: text('email').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('users_email_unique').on(t.email)],
);

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const projects = pgTable(
  'projects',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    slug: text('slug').notNull(),
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
    sourceUrl: text('source_url'),
    visibility: visibilityEnum('visibility').notNull().default('private'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('projects_slug_unique').on(t.slug), index('projects_owner_idx').on(t.ownerId)],
);

// ---------------------------------------------------------------------------
// Extractions
// ---------------------------------------------------------------------------

export const extractions = pgTable(
  'extractions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    inputType: inputTypeEnum('input_type').notNull(),
    /** URL string, or S3 key for image/PDF uploads. */
    inputRef: text('input_ref').notNull(),
    /** SHA-256 of the normalized input; enables idempotency. */
    inputHash: text('input_hash').notNull(),
    status: extractionStatusEnum('status').notNull().default('queued'),
    modelsUsed: text('models_used').array().notNull().default(sql`'{}'::text[]`),
    inputTokens: bigint('input_tokens', { mode: 'number' }).notNull().default(0),
    outputTokens: bigint('output_tokens', { mode: 'number' }).notNull().default(0),
    cacheReadTokens: bigint('cache_read_tokens', { mode: 'number' }).notNull().default(0),
    cacheCreationTokens: bigint('cache_creation_tokens', { mode: 'number' }).notNull().default(0),
    costUsd: doublePrecision('cost_usd').notNull().default(0),
    durationMs: integer('duration_ms'),
    /** Full canonical extraction tree, Zod-validated on write. */
    canonicalTree: jsonb('canonical_tree'),
    schemaVersion: text('schema_version').notNull(),
    versionNumber: integer('version_number').notNull().default(1),
    parentExtractionId: uuid('parent_extraction_id'),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    index('extractions_project_idx').on(t.projectId),
    index('extractions_status_idx').on(t.status),
    index('extractions_hash_idx').on(t.inputHash),
    index('extractions_created_idx').on(t.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// Tokens (normalized projection for fast queries + diffs)
// ---------------------------------------------------------------------------

export const tokens = pgTable(
  'tokens',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    extractionId: uuid('extraction_id')
      .notNull()
      .references(() => extractions.id, { onDelete: 'cascade' }),
    /** Stable hash id from the canonical tree. */
    tokenId: text('token_id').notNull(),
    category: tokenCategoryEnum('category').notNull(),
    name: text('name').notNull(),
    semanticRole: text('semantic_role'),
    value: jsonb('value').notNull(),
    confidence: real('confidence').notNull(),
    usageCount: integer('usage_count').notNull().default(0),
    clusterId: text('cluster_id'),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
  },
  (t) => [
    index('tokens_extraction_idx').on(t.extractionId),
    index('tokens_category_idx').on(t.category),
    uniqueIndex('tokens_extraction_token_unique').on(t.extractionId, t.tokenId),
  ],
);

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export const components = pgTable(
  'components',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    extractionId: uuid('extraction_id')
      .notNull()
      .references(() => extractions.id, { onDelete: 'cascade' }),
    componentId: text('component_id').notNull(),
    kind: componentKindEnum('kind').notNull(),
    name: text('name').notNull(),
    confidence: real('confidence').notNull(),
    domSelector: text('dom_selector'),
    variants: jsonb('variants').notNull().default(sql`'[]'::jsonb`),
    props: jsonb('props').notNull().default(sql`'[]'::jsonb`),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
  },
  (t) => [
    index('components_extraction_idx').on(t.extractionId),
    index('components_kind_idx').on(t.kind),
    uniqueIndex('components_extraction_component_unique').on(t.extractionId, t.componentId),
  ],
);

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

export const assets = pgTable(
  'assets',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    extractionId: uuid('extraction_id')
      .notNull()
      .references(() => extractions.id, { onDelete: 'cascade' }),
    assetId: text('asset_id').notNull(),
    kind: assetKindEnum('kind').notNull(),
    s3Key: text('s3_key').notNull(),
    hash: text('hash').notNull(),
    format: text('format').notNull(),
    width: integer('width'),
    height: integer('height'),
    bytes: bigint('bytes', { mode: 'number' }).notNull(),
    sourceUrl: text('source_url'),
    dedupGroup: text('dedup_group'),
    usageCount: integer('usage_count').notNull().default(1),
    svgInlineSource: text('svg_inline_source'),
    guessedIconSet: text('guessed_icon_set'),
  },
  (t) => [
    index('assets_extraction_idx').on(t.extractionId),
    index('assets_hash_idx').on(t.hash),
    index('assets_dedup_idx').on(t.dedupGroup),
  ],
);

// ---------------------------------------------------------------------------
// Audits
// ---------------------------------------------------------------------------

export const audits = pgTable(
  'audits',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    extractionId: uuid('extraction_id')
      .notNull()
      .references(() => extractions.id, { onDelete: 'cascade' }),
    auditId: text('audit_id').notNull(),
    kind: auditKindEnum('kind').notNull(),
    severity: auditSeverityEnum('severity').notNull(),
    message: text('message').notNull(),
    referencesJson: jsonb('references').notNull().default(sql`'[]'::jsonb`),
    suggestion: jsonb('suggestion'),
    evidenceJson: jsonb('evidence').notNull().default(sql`'[]'::jsonb`),
  },
  (t) => [
    index('audits_extraction_idx').on(t.extractionId),
    index('audits_severity_idx').on(t.severity),
  ],
);

// ---------------------------------------------------------------------------
// Evidence items (shared drill-down for tokens and components)
// ---------------------------------------------------------------------------

export const evidenceItems = pgTable(
  'evidence_items',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    extractionId: uuid('extraction_id')
      .notNull()
      .references(() => extractions.id, { onDelete: 'cascade' }),
    tokenId: text('token_id'),
    componentId: text('component_id'),
    source: text('source').notNull(),
    selector: text('selector'),
    viewport: text('viewport'),
    pageNumber: smallint('page_number'),
    screenshotCropKey: text('screenshot_crop_key'),
    bbox: jsonb('bbox'),
    computedStyle: jsonb('computed_style'),
    rawText: text('raw_text'),
    elementState: text('element_state'),
  },
  (t) => [
    index('evidence_extraction_idx').on(t.extractionId),
    index('evidence_token_idx').on(t.tokenId),
    index('evidence_component_idx').on(t.componentId),
  ],
);

// ---------------------------------------------------------------------------
// Encrypted BYOK API keys (signed-in users who opt in to server-side storage)
// ---------------------------------------------------------------------------

export const apiKeysEncrypted = pgTable(
  'api_keys_encrypted',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** AES-256-GCM ciphertext of the Anthropic API key, hex. */
    ciphertext: text('ciphertext').notNull(),
    iv: text('iv').notNull(),
    authTag: text('auth_tag').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
);

// ---------------------------------------------------------------------------
// Shares (public read-only links for extractions)
// ---------------------------------------------------------------------------

export const shares = pgTable(
  'shares',
  {
    token: text('token').primaryKey(),
    extractionId: uuid('extraction_id')
      .notNull()
      .references(() => extractions.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    passwordHash: text('password_hash'),
    /** Whether this share exposes the evidence drawer (screenshots + selectors). */
    exposeEvidence: boolean('expose_evidence').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('shares_extraction_idx').on(t.extractionId)],
);

// ---------------------------------------------------------------------------
// PDF page results — one row per page of a multi-page PDF extraction.
// The reconcile worker reads the full set to produce the final canonical.
// ---------------------------------------------------------------------------

export const pdfPageResults = pgTable(
  'pdf_page_results',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    extractionId: uuid('extraction_id')
      .notNull()
      .references(() => extractions.id, { onDelete: 'cascade' }),
    pageNumber: integer('page_number').notNull(),
    totalPages: integer('total_pages').notNull(),
    status: pdfPageStatusEnum('status').notNull().default('pending'),
    pageImageBlobUrl: text('page_image_blob_url').notNull(),
    canonicalFragment: jsonb('canonical_fragment'),
    costUsd: doublePrecision('cost_usd').notNull().default(0),
    inputTokens: bigint('input_tokens', { mode: 'number' }).notNull().default(0),
    outputTokens: bigint('output_tokens', { mode: 'number' }).notNull().default(0),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('pdf_page_unique').on(t.extractionId, t.pageNumber),
    index('pdf_page_extraction_idx').on(t.extractionId),
    index('pdf_page_status_idx').on(t.status),
  ],
);

// ---------------------------------------------------------------------------
// Rate-limit buckets (token bucket, counted in Redis normally; Postgres
// variant is for long-window aggregate counting / abuse analytics).
// ---------------------------------------------------------------------------

export const rateLimitEvents = pgTable(
  'rate_limit_events',
  {
    id: bigint('id', { mode: 'number' })
      .primaryKey()
      .generatedAlwaysAsIdentity(),
    principal: text('principal').notNull(),
    principalKind: text('principal_kind').notNull(),
    endpoint: text('endpoint').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('rl_principal_idx').on(t.principal),
    index('rl_occurred_idx').on(t.occurredAt),
  ],
);
