import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { BaseAIProvider } from '../src/ai/providers/base.provider.js';
import { resetAIProviderForTesting } from '../src/ai/providers/factory.js';
import {
  ChatMessage,
  GenerateOptions,
  GenerateResult,
  StreamCallbacks,
  EmbedOptions,
  EmbedResult,
  IAiRepository,
  AiConversation,
  AiMessage
} from '../src/types/ai.types.js';
import { oracleRepositoryManager } from '../src/repositories/oracle/oracle.repo.js';

class MockAIProvider extends BaseAIProvider {
  public readonly name = 'openai';
  public isAvailable(): boolean { return true; }
  public async generate(messages: ChatMessage[], options?: GenerateOptions): Promise<GenerateResult> {
    const userMsg = messages[messages.length - 1]?.content || '';
    return { text: `AI Response to: ${userMsg}`, model: options?.model || 'gpt-4o-mini' };
  }
  public async stream(_m: ChatMessage[], _c: StreamCallbacks, _o?: GenerateOptions): Promise<void> {}
  public async embed(_t: string, _o?: EmbedOptions): Promise<EmbedResult> {
    return { embedding: [0.1], model: 'text-embedding-3-small' };
  }
}

class MockAiRepository implements IAiRepository {
  public conversations: AiConversation[] = [];
  public messages: AiMessage[] = [];
  private nextConvId = 1;
  private nextMsgId = 1;

  public async createConversation(userId: number, title: string): Promise<AiConversation> {
    const conv: AiConversation = {
      conversationId: this.nextConvId++,
      userId,
      title,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.conversations.push(conv);
    return conv;
  }

  public async getConversationById(conversationId: number, userId: number): Promise<AiConversation | null> {
    return this.conversations.find(c => c.conversationId === conversationId && c.userId === userId) || null;
  }

  public async getUserConversations(userId: number, limit = 50): Promise<AiConversation[]> {
    return this.conversations
      .filter(c => c.userId === userId)
      .slice(0, limit);
  }

  public async saveMessage(
    conversationId: number,
    role: 'system' | 'user' | 'assistant',
    content: string
  ): Promise<AiMessage> {
    const msg: AiMessage = {
      messageId: this.nextMsgId++,
      conversationId,
      role,
      content,
      createdAt: new Date()
    };
    this.messages.push(msg);
    return msg;
  }

  public async getConversationMessages(conversationId: number, userId: number): Promise<AiMessage[]> {
    const conv = await this.getConversationById(conversationId, userId);
    if (!conv) return [];
    return this.messages.filter(m => m.conversationId === conversationId);
  }

  public async touchConversation(conversationId: number): Promise<void> {
    const conv = this.conversations.find(c => c.conversationId === conversationId);
    if (conv) conv.updatedAt = new Date();
  }

  public async deleteConversation(conversationId: number, userId: number): Promise<boolean> {
    const index = this.conversations.findIndex(c => c.conversationId === conversationId && c.userId === userId);
    if (index === -1) return false;
    this.conversations.splice(index, 1);
    this.messages = this.messages.filter(m => m.conversationId !== conversationId);
    return true;
  }
}

describe('Oracle AI Persistence & Ownership Security Suite', () => {
  let mockAiRepo: MockAiRepository;
  let user1Token: string;
  let user2Token: string;

  beforeEach(() => {
    mockAiRepo = new MockAiRepository();
    resetAIProviderForTesting(new MockAIProvider());
    oracleRepositoryManager.aiRepo = mockAiRepo;

    user1Token = generateAccessToken({ userId: 1001, username: 'alice', email: 'alice@nexa.app' });
    user2Token = generateAccessToken({ userId: 1002, username: 'bob', email: 'bob@nexa.app' });
  });

  it('creates a conversation and saves user and assistant messages on POST /api/ai/chat', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ message: 'Hello from Alice' });

    expect(res.status).toBe(200);
    expect(res.body.data.conversationId).toBeDefined();
    expect(res.body.data.message).toBe('AI Response to: Hello from Alice');

    // Verify in mock repository
    expect(mockAiRepo.conversations.length).toBe(1);
    expect(mockAiRepo.conversations[0].userId).toBe(1001);
    expect(mockAiRepo.messages.length).toBe(2); // 1 user + 1 assistant
    expect(mockAiRepo.messages[0].role).toBe('user');
    expect(mockAiRepo.messages[1].role).toBe('assistant');
  });

  it('lists only conversations belonging to the authenticated user', async () => {
    await mockAiRepo.createConversation(1001, "Alice's chat 1");
    await mockAiRepo.createConversation(1001, "Alice's chat 2");
    await mockAiRepo.createConversation(1002, "Bob's private chat");

    const res = await request(app)
      .get('/api/ai/conversations')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data.every((c: any) => c.userId === 1001)).toBe(true);
  });

  it('SECURITY: prevents User 2 from accessing User 1 conversation by ID', async () => {
    const aliceConv = await mockAiRepo.createConversation(1001, "Alice's Secret Plan");
    await mockAiRepo.saveMessage(aliceConv.conversationId, 'user', 'Top secret content');

    // Bob attempts to read Alice's conversation
    const res = await request(app)
      .get(`/api/ai/conversations/${aliceConv.conversationId}`)
      .set('Authorization', `Bearer ${user2Token}`);

    expect(res.status).toBe(404);
    expect(res.body.title).toBe('NOT_FOUND');
  });

  it('SECURITY: prevents User 2 from posting to User 1 conversation by ID', async () => {
    const aliceConv = await mockAiRepo.createConversation(1001, "Alice's Thread");

    // Bob attempts to send a message into Alice's conversation
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ message: 'Intruder message', conversationId: aliceConv.conversationId });

    expect(res.status).toBe(403);
    expect(res.body.title).toBe('FORBIDDEN');
  });

  it('allows owner to retrieve and delete their own conversation', async () => {
    const conv = await mockAiRepo.createConversation(1001, 'My Test Conv');
    await mockAiRepo.saveMessage(conv.conversationId, 'user', 'Test prompt');

    // Get details
    const getRes = await request(app)
      .get(`/api/ai/conversations/${conv.conversationId}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.conversation.title).toBe('My Test Conv');
    expect(getRes.body.data.messages.length).toBe(1);

    // Delete
    const delRes = await request(app)
      .delete(`/api/ai/conversations/${conv.conversationId}`)
      .set('Authorization', `Bearer ${user1Token}`);

    expect(delRes.status).toBe(200);
    expect(mockAiRepo.conversations.length).toBe(0);
  });
});
