/**
 * Typed errors for the Claude client. Each has a stable `code` for matching
 * in retry / UI layers without regexing messages.
 */

export class ClaudeError extends Error {
  public override readonly cause?: unknown;
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable: boolean = false,
    cause?: unknown,
  ) {
    super(message);
    this.name = 'ClaudeError';
    if (cause !== undefined) this.cause = cause;
  }
}

export class ClaudeRateLimitError extends ClaudeError {
  constructor(
    message: string,
    public readonly retryAfterMs: number,
    cause?: unknown,
  ) {
    super('rate_limit', message, true, cause);
    this.name = 'ClaudeRateLimitError';
  }
}

export class ClaudeAuthError extends ClaudeError {
  constructor(message: string, cause?: unknown) {
    super('auth', message, false, cause);
    this.name = 'ClaudeAuthError';
  }
}

export class ClaudeServerError extends ClaudeError {
  constructor(message: string, cause?: unknown) {
    super('server_error', message, true, cause);
    this.name = 'ClaudeServerError';
  }
}

export class ClaudeValidationError extends ClaudeError {
  constructor(message: string, cause?: unknown) {
    super('validation', message, false, cause);
    this.name = 'ClaudeValidationError';
  }
}

export class ClaudeToolOutputError extends ClaudeError {
  constructor(message: string, cause?: unknown) {
    super('tool_output', message, true, cause);
    this.name = 'ClaudeToolOutputError';
  }
}
