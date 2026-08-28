import { describe, it, expect, beforeEach } from 'vitest';
import { AIService } from '../src/ai/ai.service.js';
import { BaseAIProvider } from '../src/ai/providers/base.provider.js';
import { resetAIProviderForTesting } from '../src/ai/providers/factory.js';
import { ChatMessage, GenerateOptions, GenerateResult, StreamCallbacks, EmbedOptions, EmbedResult } from '../src/types/ai.types.js';

class MockAIProvider extends BaseAIProvider {
  public readonly name = 'mock-provider';
  public available = true;

  public isAvailable(): boolean {
    return this.available;
  }

  public async generate(messages: ChatMessage[], options?: GenerateOptions): Promise<GenerateResult> {
    return {
      text: `Echo: ${messages[messages.length - 1].content}`,
      model: options?.model || 'mock-model',
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30
      }
    };
  }

  public async stream(messages: ChatMessage[], callbacks: StreamCallbacks, _options?: GenerateOptions): Promise<void> {
    callbacks.onChunk('Chunk 1: ');
    callbacks.onChunk(messages[messages.length - 1].content);
    callbacks.onComplete?.(`Chunk 1: ${messages[messages.length - 1].content}`);
  }

  public async embed(_text: string, _options?: EmbedOptions): Promise<EmbedResult> {
    return {
      embedding: [0.1, 0.2, 0.3],
      model: 'mock-embed'
    };
  }
}

describe('NEXA AI Core Foundation Unit Tests', () => {
  let mockProvider: MockAIProvider;
  let aiService: AIService;

  beforeEach(() => {
    mockProvider = new MockAIProvider();
    resetAIProviderForTesting(mockProvider);
    aiService = new AIService();
  });

  it('should return correct service status', () => {
    const status = aiService.getStatus();
    expect(status.enabled).toBe(true);
    expect(status.provider).toBe('mock-provider');
    expect(status.available).toBe(true);
  });

  it('should generate text using provider abstraction', async () => {
    const result = await aiService.generate([
      { role: 'user', content: 'Hello NEXA AI' }
    ]);
    expect(result.text).toBe('Echo: Hello NEXA AI');
    expect(result.usage?.totalTokens).toBe(30);
  });

  it('should stream chunks using provider abstraction', async () => {
    const chunks: string[] = [];
    let completedText = '';

    await aiService.stream(
      [{ role: 'user', content: 'Streaming test' }],
      {
        onChunk: (chunk) => chunks.push(chunk),
        onComplete: (fullText) => { completedText = fullText; }
      }
    );

    expect(chunks).toEqual(['Chunk 1: ', 'Streaming test']);
    expect(completedText).toBe('Chunk 1: Streaming test');
  });

  it('should throw AI_PROVIDER_UNAVAILABLE if provider is not available', async () => {
    mockProvider.available = false;
    await expect(
      aiService.generate([{ role: 'user', content: 'Fail' }])
    ).rejects.toThrow('AI_PROVIDER_UNAVAILABLE');
  });
});
