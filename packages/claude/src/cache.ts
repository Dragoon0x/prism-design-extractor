/**
 * Prompt-cache helpers.
 *
 * The big win: mark the static system prompt (schema, tool definitions,
 * few-shot examples) as `cache_control: ephemeral` and every subsequent
 * extraction reads from cache at ~1/10 the input cost.
 *
 * Cache key = (model, system prompt + tool blocks + anything tagged with
 * cache_control). Changing any cached block invalidates the cache.
 *
 * Dynamic content (the image bytes, the scraped HTML, the PDF page) must
 * always come LAST in the message array, never tagged — otherwise it poisons
 * the cache for every subsequent run.
 */
import type Anthropic from '@anthropic-ai/sdk';

type TextBlockParam = Anthropic.Messages.TextBlockParam;

/**
 * Mark a text block as eligible for the 1-hour ephemeral prompt cache.
 * Use on: system prompt, tool schemas, invariant few-shots.
 * Do NOT use on: per-request inputs (images, URLs, scraped content).
 */
export function cacheable(text: string): TextBlockParam {
  return {
    type: 'text',
    text,
    cache_control: { type: 'ephemeral' },
  };
}

/** Same shape, un-cached. Use for dynamic content. */
export function plain(text: string): TextBlockParam {
  return {
    type: 'text',
    text,
  };
}

/** Wrap scraped/untrusted content in XML tags that the system prompt instructs Claude to ignore. */
export function untrusted(rawContent: string): TextBlockParam {
  return plain(`<untrusted_content>\n${rawContent}\n</untrusted_content>`);
}
