/**
 * Components — detected UI primitives (buttons, cards, inputs, …) with
 * variants and inferred prop surface.
 *
 * Detection is a fusion of vision bbox detection and DOM structure clustering.
 * The intelligence layer refines names and prop surfaces.
 */
import { z } from 'zod';
import { bboxSchema } from './primitives.js';
import { evidenceItemSchema } from './evidence.js';

export const componentKindSchema = z.enum([
  'button',
  'card',
  'input',
  'textarea',
  'select',
  'checkbox',
  'radio',
  'switch',
  'badge',
  'chip',
  'nav',
  'navbar',
  'sidebar',
  'tabs',
  'tab',
  'modal',
  'dialog',
  'popover',
  'tooltip',
  'toast',
  'banner',
  'alert',
  'avatar',
  'breadcrumb',
  'pagination',
  'progress',
  'slider',
  'dropdown',
  'menu',
  'list',
  'list-item',
  'table',
  'footer',
  'header',
  'hero',
  'feature',
  'pricing-card',
  'testimonial',
  'icon',
  'logo',
  'unknown',
]);
export type ComponentKind = z.infer<typeof componentKindSchema>;

/**
 * A single variant of a component (e.g. a "primary" button with hover state).
 * Variants reference tokens they use, so the UI can show a live preview.
 */
export const componentVariantSchema = z.object({
  variantId: z.string(),
  /** Human-readable variant name: `primary`, `secondary`, `ghost`, `destructive`, `disabled`, `hover`, … */
  name: z.string(),
  /** Tokens this variant uses, keyed by prop slot (e.g. `background`, `foreground`, `border`, `shadow`). */
  tokenRefs: z.record(z.string(), z.string()),
  /** Sample screenshot crop key. */
  screenshotCropKey: z.string().optional(),
  /** bbox in the source viewport / page. */
  bbox: bboxSchema.optional(),
  confidence: z.number().min(0).max(1),
});
export type ComponentVariant = z.infer<typeof componentVariantSchema>;

/**
 * The inferred prop surface for a component. Used by output generators to
 * scaffold React component signatures.
 */
export const propSignatureSchema = z.object({
  name: z.string(),
  kind: z.enum(['variant', 'size', 'state', 'boolean', 'children', 'icon', 'unknown']),
  options: z.array(z.string()).default([]),
  required: z.boolean().default(false),
  defaultValue: z.string().optional(),
});
export type PropSignature = z.infer<typeof propSignatureSchema>;

export const componentSchema = z.object({
  id: z.string(),
  kind: componentKindSchema,
  /** Human-readable name — may be refined by intelligence ("PrimaryButton"). */
  name: z.string(),
  confidence: z.number().min(0).max(1),
  /** DOM selector if detected via DOM fusion. */
  domSelector: z.string().optional(),
  /** Detected variants (primary/secondary/disabled/hover/…). */
  variants: z.array(componentVariantSchema).default([]),
  /** Inferred prop surface for codegen. */
  props: z.array(propSignatureSchema).default([]),
  evidence: z.array(evidenceItemSchema).min(1),
  tags: z.array(z.string()).default([]),
});
export type Component = z.infer<typeof componentSchema>;
