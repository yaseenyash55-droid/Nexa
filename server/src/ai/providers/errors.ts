/**
 * Provider-independent AI error codes and error class.
 * Shared across all AI providers (OpenAI, Groq, etc.)
 */

export enum AIErrorCode {
  AI_AUTH_ERROR = 'AI_AUTH_ERROR',
  AI_RATE_LIMITED = 'AI_RATE_LIMITED',
  AI_TIMEOUT = 'AI_TIMEOUT',
  AI_PROVIDER_UNAVAILABLE = 'AI_PROVIDER_UNAVAILABLE',
  AI_UNSUPPORTED_CAPABILITY = 'AI_UNSUPPORTED_CAPABILITY',
  AI_INVALID_RESPONSE = 'AI_INVALID_RESPONSE',
}

export class AIProviderError extends Error {
  public readonly code: AIErrorCode;
  public readonly provider: string;
  public readonly retryable: boolean;

  constructor(
    code: AIErrorCode,
    message: string,
    provider: string,
    retryable = false
  ) {
    super(message);
    this.name = 'AIProviderError';
    this.code = code;
    this.provider = provider;
    this.retryable = retryable;
  }
}

/**
 * Determines whether an error is retryable and eligible for fallback.
 * Only timeout, rate-limit, and provider-unavailable errors trigger fallback.
 */
export function isRetryableError(err: unknown): boolean {
  if (err instanceof AIProviderError) {
    return err.retryable;
  }
  return false;
}

/**
 * Maps an HTTP status code from an upstream AI provider into an AIProviderError.
 */
export function normalizeProviderError(
  err: any,
  providerName: string
): AIProviderError {
  const status = err?.status || err?.statusCode;
  const code = err?.code;
  const message = err?.message || 'Unknown AI provider error';

  if (status === 401 || status === 403) {
    return new AIProviderError(
      AIErrorCode.AI_AUTH_ERROR,
      'AI authentication credentials rejected by provider',
      providerName,
      false
    );
  }

  if (status === 429) {
    return new AIProviderError(
      AIErrorCode.AI_RATE_LIMITED,
      'AI rate limit reached. Please try again later.',
      providerName,
      true
    );
  }

  if (status >= 500) {
    return new AIProviderError(
      AIErrorCode.AI_PROVIDER_UNAVAILABLE,
      'AI provider service error. Please try again later.',
      providerName,
      true
    );
  }

  if (code === 'ETIMEDOUT' || code === 'ECONNABORTED' || message.includes('timeout') || message.includes('TIMEOUT')) {
    return new AIProviderError(
      AIErrorCode.AI_TIMEOUT,
      'AI provider request timed out',
      providerName,
      true
    );
  }

  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return new AIProviderError(
      AIErrorCode.AI_PROVIDER_UNAVAILABLE,
      'AI provider is unreachable',
      providerName,
      true
    );
  }

  return new AIProviderError(
    AIErrorCode.AI_INVALID_RESPONSE,
    `AI generation error: ${message}`,
    providerName,
    false
  );
}
