import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { BaseAIProvider } from '../src/ai/providers/base.provider.js';
import { resetAIProviderForTesting } from '../src/ai/providers/factory.js';
import { ChatMessage, GenerateOptions, GenerateResult, StreamCallbacks, EmbedOptions, EmbedResult } from '../src/types/ai.types.js';
import { oracleRepositoryManager } from '../src/repositories/oracle/oracle.repo.js';
import { postgresRepositoryManager } from '../src/repositories/postgres/postgres.repo.js';

vi.mock('../src/db/pool.js', () => ({
  isOraclePoolInitialized: () => false,
  executeSql: vi.fn().mockResolvedValue({ rows: [], rowsAffected: 0 })
}));

vi.mock('../src/db/postgres.pool.js', () => ({
  isPostgresPoolInitialized: () => false,
  executePostgresSql: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 })
}));

class MockStreamAIProvider extends BaseAIProvider {
  public readonly name = 'openai';
  public available = true;
  public shouldErrorInStream = false;

  public isAvailable(): boolean {
    return this.available;
  }

  public async generate(messages: ChatMessage[], options?: GenerateOptions): Promise<GenerateResult> {
    return {
      text: 'Mock non-stream response',
      model: options?.model || 'gpt-4o-mini'
    };
  }

  public async stream(messages: ChatMessage[], callbacks: StreamCallbacks, _options?: GenerateOptions): Promise<void> {
    if (this.shouldErrorInStream) {
      if (callbacks.onError) {
        callbacks.onError(new Error('Simulated upstream stream error'));
      }
      return;
    }

    const lastMsg = messages[messages.length - 1]?.content || '';
    callbacks.onChunk('Hello ');
    callbacks.onChunk('from ');
    callbacks.onChunk(`NEXA AI! Echo: ${lastMsg}`);
    if (callbacks.onComplete) {
      await callbacks.onComplete(`Hello from NEXA AI! Echo: ${lastMsg}`);
    }
  }

  public async embed(_text: string, _options?: EmbedOptions): Promise<EmbedResult> {
    return { embedding: [0.1], model: 'text-embedding-3-small' };
  }
}

class MockAiRepo {
  private convs: any[] = [];
  private msgs: any[] = [];
  async createConversation(userId: number, title: string) {
    const conv = { conversationId: 101, userId, title, createdAt: new Date(), updatedAt: new Date() };
    this.convs.push(conv);
    return conv;
  }
  async getConversationById(id: number, userId: number) {
    return this.convs.find(c => c.conversationId === id && c.userId === userId) || { conversationId: id, userId, title: 'Chat', createdAt: new Date(), updatedAt: new Date() };
  }
  async getUserConversations(userId: number) {
    return this.convs.filter(c => c.userId === userId);
  }
  async saveMessage(conversationId: number, role: any, content: string) {
    const msg = { messageId: this.msgs.length + 1, conversationId, role, content, createdAt: new Date() };
    this.msgs.push(msg);
    return msg;
  }
  async getConversationMessages(conversationId: number, userId: number) {
    return this.msgs.filter(m => m.conversationId === conversationId);
  }
  async touchConversation() {}
  async deleteConversation(id: number, userId: number) { return true; }
}

describe('POST /api/ai/chat/stream SSE Suite', () => {
  let mockProvider: MockStreamAIProvider;
  let validToken: string;

  beforeEach(() => {
    mockProvider = new MockStreamAIProvider();
    resetAIProviderForTesting(mockProvider);
    const mockRepo = new MockAiRepo() as any;
    const mockRagRepo = { getAllChunksWithEmbeddings: async () => [] } as any;
    oracleRepositoryManager.aiRepo = mockRepo;
    postgresRepositoryManager.aiRepo = mockRepo;
    oracleRepositoryManager.ragRepo = mockRagRepo;
    postgresRepositoryManager.ragRepo = mockRagRepo;
    validToken = generateAccessToken({
      userId: 701,
      username: 'streamtester',
      email: 'stream@nexa.app'
    });
  });

  afterEach(() => {
    resetAIProviderForTesting(mockProvider);
  });

  it('rejects unauthenticated stream request with 401', async () => {
    const res = await request(app)
      .post('/api/ai/chat/stream')
      .send({ message: 'Hello stream' });

    expect(res.status).toBe(401);
    expect(res.body.title).toBe('UNAUTHORIZED');
  });

  it('rejects empty message with 400 validation error', async () => {
    const res = await request(app)
      .post('/api/ai/chat/stream')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ message: '' });

    expect(res.status).toBe(400);
    expect(res.body.title).toBe('VALIDATION_ERROR');
  });

  it('returns 503 when AI provider is unavailable before streaming starts', async () => {
    mockProvider.available = false;

    const res = await request(app)
      .post('/api/ai/chat/stream')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ message: 'Hello stream' });

    expect(res.status).toBe(503);
    expect(res.body.title).toBe('SERVICE_UNAVAILABLE');
  });

const parseSse = (res: any, callback: any) => {
  let data = '';
  res.on('data', (chunk: any) => { data += chunk.toString(); });
  res.on('end', () => {
    res.text = data;
    callback(null, data);
  });
};

  it('streams chunks and complete events with text/event-stream headers', async () => {
    const res = await request(app)
      .post('/api/ai/chat/stream')
      .set('Authorization', `Bearer ${validToken}`)
      .parse(parseSse)
      .send({ message: 'Can you stream this?' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.text).toContain('event: chunk');
    expect(res.text).toContain('Hello ');
    expect(res.text).toContain('from ');
    expect(res.text).toContain('event: complete');
    expect(res.text).toContain('Echo: Can you stream this?');
  });

  it('emits error event if upstream stream fails mid-stream', async () => {
    mockProvider.shouldErrorInStream = true;

    const res = await request(app)
      .post('/api/ai/chat/stream')
      .set('Authorization', `Bearer ${validToken}`)
      .parse(parseSse)
      .send({ message: 'Trigger error' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.text).toContain('event: error');
    expect(res.text).toContain('Simulated upstream stream error');
  });
});
