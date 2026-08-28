import { AIProvider, GenerateResult, ChatMessage, GenerateOptions, StreamCallbacks } from '../../types/ai.types.js';
import { OpenAIProvider } from './openai.provider.js';
import { GroqProvider } from './groq.provider.js';
import { isRetryableError } from './errors.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

let primaryProvider: AIProvider | null = null;
let fallbackProvider: AIProvider | null = null;
let embeddingProvider: AIProvider | null = null;

function createProvider(name: string): AIProvider {
  switch (name) {
    case 'openai':
      return new OpenAIProvider({
        apiKey: env.OPENAI_API_KEY,
        defaultModel: env.OPENAI_MODEL || env.AI_MODEL || 'gpt-4o-mini',
        baseURL: env.OPENAI_BASE_URL,
        timeoutMs: env.AI_PROVIDER_TIMEOUT_MS,
        maxRetries: 2
      });
    case 'groq':
      return new GroqProvider({
        apiKey: env.GROQ_API_KEY,
        defaultModel: env.GROQ_MODEL || env.AI_MODEL || 'llama-3.3-70b-versatile',
        timeoutMs: env.AI_PROVIDER_TIMEOUT_MS,
        maxRetries: 2
      });
    default:
      // Startup validation in env.ts prevents reaching here, but defensive fallback
      logger.warn({ providerName: name }, 'Unknown AI_PROVIDER requested, defaulting to OpenAI');
      return new OpenAIProvider({
        apiKey: env.OPENAI_API_KEY,
        defaultModel: env.AI_MODEL || 'gpt-4o-mini',
        baseURL: env.OPENAI_BASE_URL,
        timeoutMs: env.AI_PROVIDER_TIMEOUT_MS,
        maxRetries: 2
      });
  }
}

export function getAIProvider(): AIProvider {
  if (primaryProvider) {
    return primaryProvider;
  }

  const providerName = env.AI_PROVIDER;
  primaryProvider = createProvider(providerName);

  if (!primaryProvider.isAvailable()) {
    logger.warn({ provider: providerName }, 'Primary AI provider is configured but not available (missing API key?)');
  }

  // Initialize fallback provider if configured and different from primary
  const fallbackName = env.AI_FALLBACK_PROVIDER;
  if (fallbackName && fallbackName !== providerName) {
    fallbackProvider = createProvider(fallbackName);
    if (!fallbackProvider.isAvailable()) {
      logger.warn({ provider: fallbackName }, 'Fallback AI provider is configured but not available (missing API key?)');
    } else {
      logger.info({ primary: providerName, fallback: fallbackName }, 'AI fallback provider initialized');
    }
  } else if (fallbackName === providerName) {
    logger.warn({ provider: providerName }, 'AI_FALLBACK_PROVIDER is the same as AI_PROVIDER — fallback is a no-op');
  }

  return primaryProvider;
}

/**
 * Returns a provider suitable for embedding operations.
 * Groq does not support embeddings, so this always returns an OpenAI provider
 * when an OPENAI_API_KEY is available, regardless of the primary AI_PROVIDER.
 */
export function getEmbeddingProvider(): AIProvider {
  if (embeddingProvider) {
    return embeddingProvider;
  }

  // If primary already supports embeddings, use it
  const primary = getAIProvider();
  if (primary.capabilities.embeddings) {
    embeddingProvider = primary;
    return embeddingProvider;
  }

  // Otherwise create a dedicated OpenAI provider for embeddings
  if (env.OPENAI_API_KEY) {
    embeddingProvider = new OpenAIProvider({
      apiKey: env.OPENAI_API_KEY,
      defaultModel: env.OPENAI_MODEL || env.AI_MODEL || 'gpt-4o-mini',
      baseURL: env.OPENAI_BASE_URL,
      timeoutMs: env.AI_PROVIDER_TIMEOUT_MS,
      maxRetries: 2
    });
    logger.info('Embedding provider initialized as OpenAI (primary provider does not support embeddings)');
    return embeddingProvider;
  }

  // No embedding-capable provider available
  logger.warn('No embedding-capable provider available. OPENAI_API_KEY is required for RAG when using Groq as primary.');
  embeddingProvider = primary; // Will throw AI_UNSUPPORTED_CAPABILITY when embed() is called
  return embeddingProvider;
}

/**
 * Returns the configured fallback provider, or null if none is configured.
 */
export function getFallbackProvider(): AIProvider | null {
  // Ensure initialization has occurred
  getAIProvider();
  return fallbackProvider;
}

/**
 * Executes a generate call with optional fallback on retryable errors.
 * Maximum chain: PRIMARY → ONE FALLBACK → STOP (no loops).
 */
export async function generateWithFallback(
  messages: ChatMessage[],
  options?: GenerateOptions
): Promise<GenerateResult & { provider: string; fallbackUsed: boolean }> {
  const primary = getAIProvider();
  const startTime = Date.now();

  try {
    const result = await primary.generate(messages, options);
    return { ...result, provider: primary.name, fallbackUsed: false };
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    logger.warn(
      { provider: primary.name, latencyMs, retryable: isRetryableError(err) },
      'Primary AI provider generate failed'
    );

    const fb = getFallbackProvider();
    if (!fb || !fb.isAvailable() || !isRetryableError(err)) {
      throw err;
    }

    // Single fallback attempt — no further fallback
    logger.info({ primary: primary.name, fallback: fb.name }, 'Attempting AI fallback provider');
    const fallbackStart = Date.now();
    try {
      const result = await fb.generate(messages, options);
      const fallbackLatency = Date.now() - fallbackStart;
      logger.info({ fallback: fb.name, latencyMs: fallbackLatency }, 'AI fallback provider succeeded');
      return { ...result, provider: fb.name, fallbackUsed: true };
    } catch (fallbackErr: unknown) {
      logger.error(
        { fallback: fb.name, latencyMs: Date.now() - fallbackStart },
        'AI fallback provider also failed'
      );
      throw fallbackErr;
    }
  }
}

/**
 * Executes a stream call with optional fallback on retryable errors.
 * Maximum chain: PRIMARY → ONE FALLBACK → STOP (no loops).
 */
export async function streamWithFallback(
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  options?: GenerateOptions
): Promise<{ provider: string; fallbackUsed: boolean }> {
  const primary = getAIProvider();

  try {
    await primary.stream(messages, callbacks, options);
    return { provider: primary.name, fallbackUsed: false };
  } catch (err: unknown) {
    const fb = getFallbackProvider();
    if (!fb || !fb.isAvailable() || !isRetryableError(err)) {
      throw err;
    }

    logger.info({ primary: primary.name, fallback: fb.name }, 'Attempting AI stream fallback provider');
    try {
      await fb.stream(messages, callbacks, options);
      return { provider: fb.name, fallbackUsed: true };
    } catch (fallbackErr: unknown) {
      logger.error({ fallback: fb.name }, 'AI stream fallback provider also failed');
      throw fallbackErr;
    }
  }
}

export function resetAIProviderForTesting(provider: AIProvider | null = null): void {
  primaryProvider = provider;
  fallbackProvider = null;
  embeddingProvider = null;
}
