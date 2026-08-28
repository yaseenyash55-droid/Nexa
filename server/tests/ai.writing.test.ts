import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { BaseAIProvider } from '../src/ai/providers/base.provider.js';
import { resetAIProviderForTesting } from '../src/ai/providers/factory.js';
import { ChatMessage, GenerateOptions, GenerateResult, StreamCallbacks, EmbedOptions, EmbedResult } from '../src/types/ai.types.js';

class MockWritingAIProvider extends BaseAIProvider {
  public readonly name = 'openai';
  public available = true;
  public lastGeneratedOptions?: GenerateOptions;
  public lastMessages?: ChatMessage[];

  public isAvailable(): boolean {
    return this.available;
  }

  public async generate(messages: ChatMessage[], options?: GenerateOptions): Promise<GenerateResult> {
    this.lastMessages = messages;
    this.lastGeneratedOptions = options;

    const userPrompt = messages[0]?.content || '';
    let responseText = 'Transformed sample text';

    if (userPrompt.includes('Generate a creative, catchy')) {
      responseText = 'Chasing sunsets in the city ✨🏙️ #NexaLife #CityVibes';
    } else if (userPrompt.includes('Fix all grammar')) {
      responseText = 'This is a clean, grammatically correct sentence.';
    } else if (userPrompt.includes('Translate the following text')) {
      responseText = '¡Bienvenidos a nuestra comunidad en NEXA!';
    }

    return {
      text: responseText,
      model: options?.model || 'gpt-4o-mini',
      usage: {
        promptTokens: 20,
        completionTokens: 25,
        totalTokens: 45
      }
    };
  }

  public async stream(_messages: ChatMessage[], _callbacks: StreamCallbacks, _options?: GenerateOptions): Promise<void> {}
  public async embed(_text: string, _options?: EmbedOptions): Promise<EmbedResult> {
    return { embedding: [0.1], model: 'text-embedding-3-small' };
  }
}

describe('POST /api/ai/writing Suite', () => {
  let mockProvider: MockWritingAIProvider;
  let validToken: string;

  beforeEach(() => {
    mockProvider = new MockWritingAIProvider();
    resetAIProviderForTesting(mockProvider);
    validToken = generateAccessToken({
      userId: 601,
      username: 'writer',
      email: 'writer@nexa.app'
    });
  });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await request(app)
      .post('/api/ai/writing')
      .send({ operation: 'generate_caption', text: 'Sunny day' });

    expect(res.status).toBe(401);
    expect(res.body.title).toBe('UNAUTHORIZED');
  });

  it('rejects invalid writing operations with 400 validation error', async () => {
    const res = await request(app)
      .post('/api/ai/writing')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ operation: 'arbitrary_operation_hack', text: 'hello' });

    expect(res.status).toBe(400);
    expect(res.body.title).toBe('VALIDATION_ERROR');
  });

  it('successfully generates caption via allowed enum operation', async () => {
    const res = await request(app)
      .post('/api/ai/writing')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        operation: 'generate_caption',
        text: 'City sunset photo'
      });

    expect(res.status).toBe(200);
    expect(res.body.data.operation).toBe('generate_caption');
    expect(res.body.data.result).toContain('Chasing sunsets in the city');
    expect(mockProvider.lastGeneratedOptions?.systemPrompt).toContain('NEXA AI Post Writing Assistant');
  });

  it('successfully fixes grammar and formats prompt correctly', async () => {
    const res = await request(app)
      .post('/api/ai/writing')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        operation: 'fix_grammar',
        text: 'this are bad grammar sentence'
      });

    expect(res.status).toBe(200);
    expect(res.body.data.operation).toBe('fix_grammar');
    expect(res.body.data.result).toBe('This is a clean, grammatically correct sentence.');
  });

  it('successfully handles translation with targetLanguage', async () => {
    const res = await request(app)
      .post('/api/ai/writing')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        operation: 'translate',
        text: 'Welcome to our community on NEXA!',
        targetLanguage: 'Spanish'
      });

    expect(res.status).toBe(200);
    expect(res.body.data.operation).toBe('translate');
    expect(res.body.data.result).toContain('¡Bienvenidos');
  });

  it('returns 503 when AI provider is disabled or unavailable', async () => {
    mockProvider.available = false;

    const res = await request(app)
      .post('/api/ai/writing')
      .set('Authorization', `Bearer ${validToken}`)
      .send({
        operation: 'make_casual',
        text: 'Hello esteemed colleague'
      });

    expect(res.status).toBe(503);
    expect(res.body.title).toBe('SERVICE_UNAVAILABLE');
  });
});
