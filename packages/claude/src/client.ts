/**
 * Prism's Claude client wrapper.
 *
 * Responsibilities:
 *   - BYOK: accept an API key per call (not just at construction).
 *   - Model routing (vision / reasoning / fast).
 *   - Prompt caching: static blocks go once, every run reads the cache.
 *   - Retries with exponential backoff on 429/503.
 *   - Cost tracking per call, emitted through an onCost callback.
 *   - Structured output via tool-use with Zod → JSON schema.
 */
import Anthropic from '@anthropic-ai/sdk';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { z } from 'zod';
import {
  ClaudeAuthError,
  ClaudeError,
  ClaudeRateLimitError,
  ClaudeServerError,
  ClaudeToolOutputError,
} from './errors.js';
import { defaultModelFor, estimateCostUsd, type KnownModel, type ModelRole } from './models.js';

type MessageParam = Anthropic.Messages.MessageParam;
type TextBlockParam = Anthropic.Messages.TextBlockParam;
type ImageBlockParam = Anthropic.Messages.ImageBlockParam;
type ToolParam = Anthropic.Messages.Tool;

export interface CallBudget {
  maxInputTokens?: number;
  maxOutputTokens: number;
  /** Extended thinking budget for reasoning calls. */
  thinkingBudgetTokens?: number;
}

export interface CostRecord {
  stage: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  costUsd: number;
  durationMs: number;
}

export interface MakeCallOptions {
  /** Provided by the caller; BYOK means this rotates per user. */
  apiKey: string;
  /** Short tag identifying the pipeline stage (e.g. "url:vision-pass"). */
  stage: string;
  role: ModelRole;
  /** Override default model for this role. */
  model?: KnownModel | string;
  /** Cacheable system prompt — the big, stable block. */
  system: TextBlockParam[];
  /** Dynamic user content — text / image blocks. Always last, never cached. */
  userContent: Array<TextBlockParam | ImageBlockParam>;
  budget: CallBudget;
  /** Tool-use for structured output. */
  tools?: ToolParam[];
  /** Force a specific tool. */
  forceTool?: string;
  /** Called for every successful call so the worker can stream cost deltas. */
  onCost?: (record: CostRecord) => void;
  /** Override default retry policy. */
  maxRetries?: number;
  /** AbortSignal for cancellation (job timeouts). */
  signal?: AbortSignal;
}

const DEFAULT_MAX_RETRIES = 4;

/** Heuristic: parse Anthropic's Retry-After header, fall back to exponential. */
function retryDelayMs(attempt: number, retryAfterHeader?: string | null): number {
  if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);
    if (Number.isFinite(seconds) && seconds > 0) return seconds * 1_000;
  }
  return Math.min(30_000, 1_000 * Math.pow(2, attempt)) + Math.floor(Math.random() * 250);
}

function toClaudeError(err: unknown): ClaudeError {
  if (err instanceof Anthropic.APIError) {
    const status = err.status;
    if (status === 401 || status === 403) {
      return new ClaudeAuthError(`Authentication failed: ${err.message}`, err);
    }
    if (status === 429) {
      const retryAfter = err.headers?.['retry-after'];
      const retryMs = retryDelayMs(0, Array.isArray(retryAfter) ? retryAfter[0] : retryAfter);
      return new ClaudeRateLimitError(`Rate limited: ${err.message}`, retryMs, err);
    }
    if (status >= 500) {
      return new ClaudeServerError(`Server error (${status}): ${err.message}`, err);
    }
    return new ClaudeError('api_error', err.message, false, err);
  }
  if (err instanceof ClaudeError) return err;
  if (err instanceof Error) return new ClaudeError('unknown', err.message, false, err);
  return new ClaudeError('unknown', String(err), false, err);
}

/**
 * Make a single Claude call with retries, cost tracking, and structured output.
 * Returns the raw response for the caller to pluck tool_use blocks / text out of.
 */
export async function call(opts: MakeCallOptions): Promise<Anthropic.Messages.Message> {
  const model = opts.model ?? defaultModelFor(opts.role);
  const client = new Anthropic({ apiKey: opts.apiKey });
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;

  const messages: MessageParam[] = [
    {
      role: 'user',
      content: opts.userContent,
    },
  ];

  const thinking =
    opts.role === 'reasoning' && opts.budget.thinkingBudgetTokens && opts.budget.thinkingBudgetTokens > 0
      ? {
          type: 'enabled' as const,
          budget_tokens: opts.budget.thinkingBudgetTokens,
        }
      : undefined;

  let lastError: ClaudeError | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (opts.signal?.aborted) {
      throw new ClaudeError('aborted', 'Request aborted by caller', false);
    }
    const started = Date.now();
    try {
      const response = await client.messages.create(
        {
          model,
          max_tokens: opts.budget.maxOutputTokens,
          system: opts.system,
          messages,
          ...(opts.tools && opts.tools.length > 0 ? { tools: opts.tools } : {}),
          ...(opts.forceTool
            ? { tool_choice: { type: 'tool' as const, name: opts.forceTool } }
            : {}),
          ...(thinking ? { thinking } : {}),
        },
        { signal: opts.signal },
      );

      const durationMs = Date.now() - started;
      const usage = response.usage;
      const inputTokens = usage.input_tokens;
      const outputTokens = usage.output_tokens;
      const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
      const cacheCreationTokens = usage.cache_creation_input_tokens ?? 0;
      const costUsd = estimateCostUsd({
        model,
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheCreationTokens,
      });
      opts.onCost?.({
        stage: opts.stage,
        model,
        inputTokens,
        outputTokens,
        cacheReadTokens,
        cacheCreationTokens,
        costUsd,
        durationMs,
      });
      return response;
    } catch (err) {
      const typed = toClaudeError(err);
      lastError = typed;
      if (!typed.retryable || attempt === maxRetries) throw typed;
      const delay =
        typed instanceof ClaudeRateLimitError ? typed.retryAfterMs : retryDelayMs(attempt);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, delay);
        opts.signal?.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            reject(new ClaudeError('aborted', 'Request aborted during retry wait', false));
          },
          { once: true },
        );
      });
    }
  }
  throw lastError ?? new ClaudeError('unknown', 'Exhausted retries with no error recorded', false);
}

/**
 * Make a call that MUST produce a tool-use block conforming to a Zod schema.
 * Retries once with a stricter reminder on validation failure.
 */
export async function callWithStructuredOutput<TSchema extends z.ZodTypeAny>(
  opts: Omit<MakeCallOptions, 'tools' | 'forceTool'> & {
    toolName: string;
    toolDescription: string;
    outputSchema: TSchema;
  },
): Promise<{ output: z.infer<TSchema>; raw: Anthropic.Messages.Message }> {
  const jsonSchema = zodToJsonSchema(opts.outputSchema, { target: 'openApi3' });
  const tool: ToolParam = {
    name: opts.toolName,
    description: opts.toolDescription,
    input_schema: jsonSchema as ToolParam['input_schema'],
  };

  const attempt = async (userContentOverride?: MakeCallOptions['userContent']) =>
    call({
      ...opts,
      userContent: userContentOverride ?? opts.userContent,
      tools: [tool],
      forceTool: opts.toolName,
    });

  let response = await attempt();
  let toolUse = response.content.find(
    (block): block is Anthropic.Messages.ToolUseBlock => block.type === 'tool_use',
  );
  if (!toolUse) {
    throw new ClaudeToolOutputError(
      `Expected a tool_use block for "${opts.toolName}" but none was returned`,
    );
  }
  const firstParse = opts.outputSchema.safeParse(toolUse.input);
  if (firstParse.success) return { output: firstParse.data, raw: response };

  // Retry once with an explicit correction request.
  const correction: Anthropic.Messages.TextBlockParam = {
    type: 'text',
    text:
      `Your previous tool call failed schema validation. Errors:\n` +
      firstParse.error.issues.map((e) => `- ${e.path.join('.')}: ${e.message}`).join('\n') +
      `\n\nRe-invoke the tool with a corrected payload.`,
  };
  response = await attempt([...opts.userContent, correction]);
  toolUse = response.content.find(
    (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use',
  );
  if (!toolUse) {
    throw new ClaudeToolOutputError(
      `Retry still did not produce a tool_use block for "${opts.toolName}"`,
    );
  }
  const secondParse = opts.outputSchema.safeParse(toolUse.input);
  if (!secondParse.success) {
    throw new ClaudeToolOutputError(
      `Tool output failed schema validation twice: ${secondParse.error.message}`,
    );
  }
  return { output: secondParse.data, raw: response };
}
