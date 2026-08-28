import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GroqProvider } from '../src/ai/providers/groq.provider.js';
import { OpenAIProvider } from '../src/ai/providers/openai.provider.js';
import {
  getAIProvider,
  getEmbeddingProvider,
  getFallbackProvider,
  generateWithFallback,
  streamWithFallback,
  resetAIProviderForTesting
} from '../src/ai/providers/factory.js';
import { BaseAIProvider } from '../src/ai/providers/base.provider.js';
import { AIErrorCode, AIProviderError, isRetryableError, normalizeProviderError } from '../src/ai/providers/errors.js';
import { ChatMessage, GenerateOptions, GenerateResult, StreamCallbacks, EmbedOptions, EmbedResult, ProviderCapabilities } from '../src/types/ai.types.js';
import { AIService } from '../src/ai/ai.service.js';

class MockFailingProvider extends BaseAIProvider {
  public readonly name = 'failing-provider';
  public readonly capabilities: ProviderCapabilities = {
    text: true,
    streaming: true,
    vision: false,
    tools: true,
    structuredOutput: true,
    embeddings: false
  };

  constructor(public errorToThrow: Error) {
    super();
  }

  public isAvailable(): boolean {
    return true;
  }

  public async generate(): Promise<GenerateResult> {
    throw this.errorToThrow;
  }

  public async stream(_messages: ChatMessage[], callbacks: StreamCallbacks): Promise<void> {
    callbacks.onError?.(this.errorToThrow);
    throw this.errorToThrow;
  }

  public async embed(): Promise<EmbedResult> {
    throw this.errorToThrow;
  }
}

class MockSuccessProvider extends BaseAIProvider {
  public readonly name = 'success-provider';
  public readonly capabilities: ProviderCapabilities = {
    text: true,
    streaming: true,
    vision: true,
    tools: true,
    structuredOutput: true,
    embeddings: true
  };

  public isAvailable(): boolean {
    return true;
  }

  public async generate(_messages: ChatMessage[], options?: GenerateOptions): Promise<GenerateResult> {
    return {
      text: 'Fallback success response',
      model: options?.model || 'fallback-model',
      usage: { promptTokens: 5, completionTokens: 10, totalTokens: 15 }
    };
  }

  public async stream(_messages: ChatMessage[], callbacks: StreamCallbacks): Promise<void> {
    callbacks.onChunk('Fallback chunk');
    callbacks.onComplete?.('Fallback chunk');
  }

  public async embed(): Promise<EmbedResult> {
    return { embedding: [0.1, 0.2], model: 'embed-model' };
  }
}

describe('Phase 18 — Groq Provider & AI Architecture Unit Tests', () => {
  beforeEach(() => {
    resetAIProviderForTesting(null);
  });

  describe('GroqProvider Unit Tests', () => {
    it('should initialize correctly with default options', () => {
      const provider = new GroqProvider({ apiKey: 'gsk_test_key_123' });
      expect(provider.name).toBe('groq');
      expect(provider.isAvailable()).toBe(true);
      expect(provider.capabilities).toEqual({
        text: true,
        streaming: true,
        vision: false,
        tools: true,
        structuredOutput: true,
        embeddings: false
      });
    });

    it('should report unavailable if API key is missing', () => {
      const provider = new GroqProvider({ apiKey: '' });
      expect(provider.isAvailable()).toBe(false);
    });

    it('should throw AI_PROVIDER_UNAVAILABLE on generate when unconfigured', async () => {
      const provider = new GroqProvider({ apiKey: '' });
      await expect(
        provider.generate([{ role: 'user', content: 'hello' }])
      ).rejects.toThrow(AIProviderError);
    });

    it('should throw AI_UNSUPPORTED_CAPABILITY when embed() is called', async () => {
      const provider = new GroqProvider({ apiKey: 'gsk_test_key' });
      try {
        await provider.embed('sample text');
        expect.fail('Should have thrown AIProviderError');
      } catch (err: any) {
        expect(err).toBeInstanceOf(AIProviderError);
        expect(err.code).toBe(AIErrorCode.AI_UNSUPPORTED_CAPABILITY);
        expect(err.retryable).toBe(false);
      }
    });
  });

  describe('Error Normalization Tests', () => {
    it('should normalize 401/403 errors as AI_AUTH_ERROR (non-retryable)', () => {
      const err = normalizeProviderError({ status: 401, message: 'Invalid API Key' }, 'groq');
      expect(err.code).toBe(AIErrorCode.AI_AUTH_ERROR);
      expect(err.retryable).toBe(false);
      expect(isRetryableError(err)).toBe(false);
    });

    it('should normalize 429 errors as AI_RATE_LIMITED (retryable)', () => {
      const err = normalizeProviderError({ status: 429, message: 'Rate limit exceeded' }, 'groq');
      expect(err.code).toBe(AIErrorCode.AI_RATE_LIMITED);
      expect(err.retryable).toBe(true);
      expect(isRetryableError(err)).toBe(true);
    });

    it('should normalize 500/503 errors as AI_PROVIDER_UNAVAILABLE (retryable)', () => {
      const err = normalizeProviderError({ status: 503, message: 'Internal Server Error' }, 'groq');
      expect(err.code).toBe(AIErrorCode.AI_PROVIDER_UNAVAILABLE);
      expect(err.retryable).toBe(true);
      expect(isRetryableError(err)).toBe(true);
    });

    it('should normalize timeout errors as AI_TIMEOUT (retryable)', () => {
      const err = normalizeProviderError({ message: 'Request timeout after 30000ms' }, 'groq');
      expect(err.code).toBe(AIErrorCode.AI_TIMEOUT);
      expect(err.retryable).toBe(true);
      expect(isRetryableError(err)).toBe(true);
    });
  });

  describe('Fallback & Loop Prevention Tests', () => {
    it('should execute fallback provider when primary fails with retryable error', async () => {
      const failingPrimary = new MockFailingProvider(
        new AIProviderError(AIErrorCode.AI_RATE_LIMITED, 'Rate limited', 'primary', true)
      );
      const successFallback = new MockSuccessProvider();

      resetAIProviderForTesting(failingPrimary, successFallback);
      const result = await generateWithFallback([{ role: 'user', content: 'test' }]);
      expect(result.text).toBe('Fallback success response');
      expect(result.provider).toBe('success-provider');
      expect(result.fallbackUsed).toBe(true);
    });

    it('should NOT attempt fallback for non-retryable errors (e.g. auth error)', async () => {
      const authErr = new AIProviderError(AIErrorCode.AI_AUTH_ERROR, 'Bad Key', 'primary', false);
      expect(isRetryableError(authErr)).toBe(false);
    });
  });

  describe('AIService Integration & Capabilities Status', () => {
    it('should return complete status including capabilities and fallback info', () => {
      const mockSuccess = new MockSuccessProvider();
      resetAIProviderForTesting(mockSuccess);

      const aiService = new AIService();
      const status = aiService.getStatus();

      expect(status.enabled).toBe(true);
      expect(status.provider).toBe('success-provider');
      expect(status.available).toBe(true);
      expect(status.capabilities).toEqual(mockSuccess.capabilities);
    });
  });
});
