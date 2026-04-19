/**
 * Audits — consistency, accessibility, and debt findings attached to the
 * canonical tree. These are produced by the intelligence layer + axe-core.
 */
import { z } from 'zod';
import { evidenceItemSchema } from './evidence.js';

export const auditSeveritySchema = z.enum(['info', 'minor', 'major', 'critical']);
export type AuditSeverity = z.infer<typeof auditSeveritySchema>;

export const auditKindSchema = z.enum([
  'contrast',
  'a11y',
  'duplication',
  'orphan',
  'magic-value',
  'font-perf',
  'missing-semantic-name',
  'scale-violation',
  'hardcoded-hex',
  'inconsistent-radius',
  'inconsistent-spacing',
  'unused-token',
]);
export type AuditKind = z.infer<typeof auditKindSchema>;

export const auditSchema = z.object({
  id: z.string(),
  kind: auditKindSchema,
  severity: auditSeveritySchema,
  message: z.string(),
  /** Tokens / components / assets this audit refers to, by id. */
  references: z.array(
    z.object({
      entityType: z.enum(['token', 'component', 'asset']),
      entityId: z.string(),
    }),
  ),
  /** Optional suggested fix, machine-readable. */
  suggestion: z
    .object({
      kind: z.enum([
        'collapse-tokens',
        'rename-token',
        'add-missing-token',
        'remove-orphan',
        'fix-contrast',
      ]),
      detail: z.record(z.string(), z.unknown()),
    })
    .optional(),
  evidence: z.array(evidenceItemSchema).default([]),
});
export type Audit = z.infer<typeof auditSchema>;
