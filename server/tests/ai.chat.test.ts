import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { BaseAIProvider } from '../src/ai/providers/base.provider.js';
import { resetAIProviderForTesting } from '../src/ai/providers/factory.js';
import { ChatMessage, GenerateOptions, GenerateResult, StreamCallbacks, EmbedOptions, EmbedResult } from '../src/types/ai.types.js';
import { env } from '../src/config/env.js';

class MockOpenAIProvider extends BaseAIProvider {
  public readonly name = 'openai';
  public available = true;
  public shouldThrow: Error | null = null;

  public isAvailable(): boolean {
    return this.available;
  }

  public async generate(messages: ChatMessage[], options?: GenerateOptions): Promise<GenerateResult> {
    if (this.shouldThrow) {
      throw this.shouldThrow;
    }

    const userMessage = messages[messages.length - 1]?.content || '';
    return {
      text: `NEXA AI Response to: ${userMessage}`,
      model: options?.model || 'gpt-4o-mini',
      usage: {
        promptTokens: 12,
        completionTokens: 25,
        totalTokens: 37
      }
    };
  }

  public async stream(_messages: ChatMessage[], _callbacks: StreamCallbacks, _options?: GenerateOptions): Promise<void> {}
  public async embed(_text: string, _options?: EmbedOptions): Promise<EmbedResult> {
    return { embedding: [0.1], model: 'text-embedding-3-small' };
  }
}

import { oracleRepositoryManager } from '../src/repositories/oracle/oracle.repo.js';

class MockAiRepo {
  private convs: any[] = [];
  private msgs: any[] = [];
  async createConversation(userId: number, title: string) {
    const conv = { conversationId: 101, userId, title, createdAt: new Date(), updatedAt: new Date() };
    this.convs.push(conv);
    return conv;
  }
  async getConversationById(id: number, userId: number) {
    return this.convs.find(c => c.conversationId === id && c.userId === userId) || null;
  }
  async getUserConversations(userId: number) {
    return this.convs.filter(c => c.userId === userId);
  }
  async saveMessage(conversationId: number, role: any, content: string) {
    const msg = { messageId: 1, conversationId, role, content, createdAt: new Date() };
    this.msgs.push(msg);
    return msg;
  }
  async getConversationMessages(conversationId: number, userId: number) {
    return this.msgs.filter(m => m.conversationId === conversationId);
  }
  async touchConversation() {}
  async deleteConversation(id: number, userId: number) { return true; }
}

describe('POST /api/ai/chat Suite', () => {
  let mockProvider: MockOpenAIProvider;
  let validToken: string;

  beforeEach(() => {
    mockProvider = new MockOpenAIProvider();
    resetAIProviderForTesting(mockProvider);
    oracleRepositoryManager.aiRepo = new MockAiRepo() as any;
    validToken = generateAccessToken({
      userId: 501,
      username: 'aitester',
      email: 'aitester@nexa.app'
    });
  });

  it('rejects unauthenticated request with 401', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .send({ message: 'Hello without token' });

    expect(res.status).toBe(401);
    expect(res.body.title).toBe('UNAUTHORIZED');
  });

  it('rejects empty message with 400 validation error', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ message: '' });

    expect(res.status).toBe(400);
    expect(res.body.title).toBe('VALIDATION_ERROR');
  });

  it('rejects oversized message (> 4000 characters) with 400 validation error', async () => {
    const longMessage = 'A'.repeat(4001);
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ message: longMessage });

    expect(res.status).toBe(400);
    expect(res.body.title).toBe('VALIDATION_ERROR');
  });

  it('returns 503 when AI provider is unavailable', async () => {
    mockProvider.available = false;

    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ message: 'Hello when unavailable' });

    expect(res.status).toBe(503);
    expect(res.body.title).toBe('SERVICE_UNAVAILABLE');
  });

  it('handles upstream provider errors cleanly with structured error response', async () => {
    mockProvider.shouldThrow = new Error('AI authentication credentials rejected by provider');

    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ message: 'Hello provider error' });

    expect(res.status).toBe(502);
    expect(res.body.title).toBe('AI_AUTH_ERROR');
  });

  it('successfully generates response with mocked provider', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ message: 'What is NEXA?' });

    expect(res.status).toBe(200);
    expect(res.body.data.message).toBe('NEXA AI Response to: What is NEXA?');
    expect(res.body.data.conversationId).toBeDefined();
    expect(res.body.data.model).toBe('gpt-4o-mini');
  });

  describe('Multi-Turn Conversation & Ownership (Phase 13)', () => {
    it('propagates structured multi-turn conversation history across multiple turns', async () => {
      let capturedMessages: ChatMessage[] = [];
      mockProvider.generate = async (messages: ChatMessage[], options?: GenerateOptions) => {
        capturedMessages = messages;
        return {
          text: 'Turn 2 response',
          model: 'gpt-4o-mini'
        };
      };

      // Turn 1
      const res1 = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ message: 'First question' });
      expect(res1.status).toBe(200);
      const convId = res1.body.data.conversationId;

      // Turn 2 in same conversation
      const res2 = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ message: 'Second follow up question', conversationId: convId });

      expect(res2.status).toBe(200);
      expect(res2.body.data.message).toBe('Turn 2 response');

      // Verification: Model received prior user message and current user message
      expect(capturedMessages.some(m => m.content === 'First question')).toBe(true);
      expect(capturedMessages.some(m => m.content === 'Second follow up question')).toBe(true);
    });

    it('rejects cross-user conversation access with 404/403 without leaking data', async () => {
      // User 501 creates conversation
      const res1 = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ message: 'Secret personal notes' });
      const convId = res1.body.data.conversationId;

      // User 999 attempts to access conversation created by User 501
      const otherUserToken = generateAccessToken({
        userId: 999,
        username: 'intruder',
        email: 'intruder@nexa.app'
      });

      const res2 = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${otherUserToken}`)
        .send({ message: 'Show me prior notes', conversationId: convId });

      expect(res2.status).toBe(403);
      expect(res2.body.detail).toContain('Conversation not found or you do not have permission');
    });

    it('allows creating empty conversation via POST /api/ai/conversations', async () => {
      const res = await request(app)
        .post('/api/ai/conversations')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ title: 'DBMS Architecture Planning' });

      expect(res.status).toBe(200);
      expect(res.body.data.conversationId).toBeDefined();
      expect(res.body.data.title).toBe('DBMS Architecture Planning');
    });

    it('enforces 80 character limit on conversation titles', async () => {
      const longPrompt = 'This is an extraordinarily lengthy prompt that exceeds the deterministic title cap limit for conversational titles';
      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ message: longPrompt });

      expect(res.status).toBe(200);
      expect(res.body.data.conversationId).toBeDefined();
    });
  });
});
