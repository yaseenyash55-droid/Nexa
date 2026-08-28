import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { generateAccessToken } from '../src/utils/jwt.js';
import { toolRegistry, ToolExecutionContext } from '../src/ai/tools/tool.registry.js';
import { BaseAIProvider } from '../src/ai/providers/base.provider.js';
import { resetAIProviderForTesting } from '../src/ai/providers/factory.js';
import { ChatMessage, GenerateOptions, GenerateResult, StreamCallbacks, EmbedOptions, EmbedResult } from '../src/types/ai.types.js';
import { oracleRepositoryManager } from '../src/repositories/oracle/oracle.repo.js';
import { postgresRepositoryManager } from '../src/repositories/postgres/postgres.repo.js';

class MockToolCallingAIProvider extends BaseAIProvider {
  public readonly name = 'openai';
  public isAvailable(): boolean {
    return true;
  }

  public async generate(messages: ChatMessage[], options?: GenerateOptions): Promise<GenerateResult> {
    const lastMsg = messages[messages.length - 1];

    // If the last message is a tool result, return finalized answer
    if (lastMsg.role === 'tool') {
      return {
        text: `Based on your profile/data: ${lastMsg.content}`,
        model: options?.model || 'gpt-4o-mini'
      };
    }

    // Simulate tool call based on user query
    if (lastMsg.content.includes('who am i') || lastMsg.content.includes('my profile')) {
      return {
        text: '',
        model: options?.model || 'gpt-4o-mini',
        toolCalls: [
          {
            id: 'call_123_profile',
            name: 'get_my_profile',
            arguments: {}
          }
        ]
      };
    }

    if (lastMsg.content.includes('my notifications')) {
      return {
        text: '',
        model: options?.model || 'gpt-4o-mini',
        toolCalls: [
          {
            id: 'call_456_notifs',
            name: 'get_my_notifications',
            arguments: { limit: 5 }
          }
        ]
      };
    }

    if (lastMsg.content.includes('search posts')) {
      return {
        text: '',
        model: options?.model || 'gpt-4o-mini',
        toolCalls: [
          {
            id: 'call_789_posts',
            name: 'search_public_posts',
            arguments: { query: 'technology', limit: 3 }
          }
        ]
      };
    }

    if (lastMsg.content.includes('search users')) {
      return {
        text: '',
        model: options?.model || 'gpt-4o-mini',
        toolCalls: [
          {
            id: 'call_999_users',
            name: 'search_users',
            arguments: { query: 'alex', limit: 2 }
          }
        ]
      };
    }

    return {
      text: `General response to: ${lastMsg.content}`,
      model: options?.model || 'gpt-4o-mini'
    };
  }

  public async stream(_messages: ChatMessage[], _callbacks: StreamCallbacks, _options?: GenerateOptions): Promise<void> {}
  public async embed(_text: string, _options?: EmbedOptions): Promise<EmbedResult> {
    return { embedding: [0.1], model: 'text-embedding-3-small' };
  }
}

class MockAiRepo {
  private convs: any[] = [];
  private msgs: any[] = [];
  async createConversation(userId: number, title: string) {
    const conv = { conversationId: 201, userId, title, createdAt: new Date(), updatedAt: new Date() };
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

describe('NEXA AI Tool Calling & Security Suite', () => {
  let mockProvider: MockToolCallingAIProvider;
  let userAliceToken: string;
  let userBobToken: string;

  beforeEach(() => {
    mockProvider = new MockToolCallingAIProvider();
    resetAIProviderForTesting(mockProvider);
    const mockRepo = new MockAiRepo() as any;
    oracleRepositoryManager.aiRepo = mockRepo;
    postgresRepositoryManager.aiRepo = mockRepo;

    const mockPrivacyRepo = {
      getPrivacySettings: vi.fn().mockResolvedValue({
        userId: 1001,
        isPrivate: false,
        showActivityStatus: true,
        allowTagging: 'EVERYONE',
        allowDirectMessages: 'EVERYONE'
      })
    };
    oracleRepositoryManager.privacyRepo = mockPrivacyRepo as any;
    postgresRepositoryManager.privacyRepo = mockPrivacyRepo as any;

    userAliceToken = generateAccessToken({
      userId: 1001,
      username: 'alice',
      email: 'alice@nexa.app'
    });

    userBobToken = generateAccessToken({
      userId: 1002,
      username: 'bob',
      email: 'bob@nexa.app'
    });
  });

  describe('Registry Definition & Schema Enforcement', () => {
    it('registers exactly the 4 approved read-only tools', () => {
      const tools = toolRegistry.getAllTools();
      const toolNames = tools.map(t => t.name);

      expect(toolNames).toContain('get_my_profile');
      expect(toolNames).toContain('get_my_notifications');
      expect(toolNames).toContain('search_public_posts');
      expect(toolNames).toContain('search_users');
      expect(tools.length).toBe(4);
    });

    it('rejects unknown tools safely with error', async () => {
      const context: ToolExecutionContext = { userId: 1001, username: 'alice' };
      const res = await toolRegistry.executeTool('drop_table_users', {}, context);

      expect(res.success).toBe(false);
      expect(res.error).toContain("Tool 'drop_table_users' not found in registry");
    });

    it('rejects invalid argument types and extra parameters on get_my_notifications', async () => {
      const context: ToolExecutionContext = { userId: 1001, username: 'alice' };
      // limit > 20 should fail Zod validation
      const res = await toolRegistry.executeTool('get_my_notifications', { limit: 999 }, context);

      expect(res.success).toBe(false);
      expect(res.error).toContain('Invalid arguments');
    });

    it('rejects missing required parameters on search_public_posts', async () => {
      const context: ToolExecutionContext = { userId: 1001, username: 'alice' };
      const res = await toolRegistry.executeTool('search_public_posts', {}, context);

      expect(res.success).toBe(false);
      expect(res.error).toContain('Invalid arguments');
    });
  });

  describe('Cross-User Authorization & Security Boundaries', () => {
    it('executes get_my_profile strictly bound to context.userId (cannot be spoofed)', async () => {
      // Setup mock user in repo
      const mockUserRepo = {
        findById: vi.fn().mockImplementation((userId: number) => {
          return Promise.resolve({
            userId,
            username: userId === 1001 ? 'alice' : 'bob',
            displayName: userId === 1001 ? 'Alice In Wonderland' : 'Bob Builder',
            bio: 'Verified User Bio',
            avatarUrl: null,
            coverImageUrl: null,
            isVerified: true,
            followersCount: 42,
            followingCount: 15,
            postsCount: 7,
            passwordHash: '$2a$12$SECRET_HASH_DO_NOT_EXPOSE',
            email: 'alice@nexa.app'
          });
        }),
        isFollowing: vi.fn().mockResolvedValue(false)
      };

      oracleRepositoryManager.userRepo = mockUserRepo as any;
      postgresRepositoryManager.userRepo = mockUserRepo as any;

      const context: ToolExecutionContext = { userId: 1001, username: 'alice' };
      const res = await toolRegistry.executeTool('get_my_profile', {}, context);

      expect(res.success).toBe(true);
      expect(res.data.userId).toBe(1001);
      expect(res.data.username).toBe('alice');
      // Verify passwordHash and email are NOT exposed in tool return payload
      expect(res.data.passwordHash).toBeUndefined();
      expect(res.data.email).toBeUndefined();
    });

    it('executes get_my_notifications strictly scoped to authenticated user context', async () => {
      const mockNotifRepo = {
        getUserNotifications: vi.fn().mockResolvedValue({
          data: [
            {
              notificationId: 55,
              type: 'LIKE',
              actorUserId: 1005,
              actor: {
                userId: 1005,
                username: 'charlie',
                displayName: 'Charlie'
              },
              postId: 10,
              isRead: false,
              createdAt: new Date().toISOString()
            }
          ]
        }),
        getUnreadCount: vi.fn().mockResolvedValue(1)
      };

      oracleRepositoryManager.notificationRepo = mockNotifRepo as any;

      const context: ToolExecutionContext = { userId: 1001, username: 'alice' };
      const res = await toolRegistry.executeTool('get_my_notifications', { limit: 5 }, context);

      expect(res.success).toBe(true);
      expect(mockNotifRepo.getUserNotifications).toHaveBeenCalledWith(1001, undefined, 5);
      expect(res.data.unreadCount).toBe(1);
      expect(res.data.notifications[0].actorUsername).toBe('charlie');
    });

    it('executes search_public_posts with query filtering', async () => {
      const mockPostRepo = {
        getGlobalFeed: vi.fn().mockResolvedValue({
          data: [
            {
              postId: 101,
              userId: 1003,
              author: {
                userId: 1003,
                username: 'dave',
                displayName: 'Dave'
              },
              content: 'Excited about the new AI technology in NEXA!',
              likesCount: 12,
              commentsCount: 3,
              createdAt: new Date().toISOString()
            },
            {
              postId: 102,
              userId: 1004,
              author: {
                userId: 1004,
                username: 'eve',
                displayName: 'Eve'
              },
              content: 'Just had lunch in Paris #travel',
              likesCount: 5,
              commentsCount: 0,
              createdAt: new Date().toISOString()
            }
          ],
          hasMore: false
        })
      };

      oracleRepositoryManager.postRepo = mockPostRepo as any;

      const context: ToolExecutionContext = { userId: 1001, username: 'alice' };
      const res = await toolRegistry.executeTool('search_public_posts', { query: 'technology', limit: 5 }, context);

      expect(res.success).toBe(true);
      expect(res.data.count).toBe(1);
      expect(res.data.posts[0].postId).toBe(101);
      expect(res.data.posts[0].authorUsername).toBe('dave');
    });

    it('executes search_users filtering out password hashes and internal keys', async () => {
      const mockUserRepo = {
        searchUsers: vi.fn().mockResolvedValue([
          {
            userId: 2001,
            username: 'alex_cool',
            displayName: 'Alex Cool',
            bio: 'Coder & Designer',
            avatarUrl: null,
            isVerified: true,
            followersCount: 100,
            followingCount: 50,
            passwordHash: '$2b$10$SUPER_SECRET_HASH'
          }
        ])
      };

      oracleRepositoryManager.userRepo = mockUserRepo as any;

      const context: ToolExecutionContext = { userId: 1001, username: 'alice' };
      const res = await toolRegistry.executeTool('search_users', { query: 'alex', limit: 5 }, context);

      expect(res.success).toBe(true);
      expect(res.data.count).toBe(1);
      expect(res.data.users[0].username).toBe('alex_cool');
      expect(res.data.users[0].passwordHash).toBeUndefined();
    });
  });

  describe('End-to-End Chat Tool Calling Loop', () => {
    it('executes tool calling loop when user asks about their profile', async () => {
      const mockUserRepo = {
        findById: vi.fn().mockResolvedValue({
          userId: 1001,
          username: 'alice',
          displayName: 'Alice In Wonderland',
          bio: 'NEXA Explorer',
          avatarUrl: null,
          coverImageUrl: null,
          isVerified: true,
          followersCount: 99,
          followingCount: 20,
          postsCount: 15,
          createdAt: new Date()
        }),
        isFollowing: vi.fn().mockResolvedValue(false)
      };
      oracleRepositoryManager.userRepo = mockUserRepo as any;
      postgresRepositoryManager.userRepo = mockUserRepo as any;

      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${userAliceToken}`)
        .send({ message: 'Can you show me my profile stats?' });

      expect(res.status).toBe(200);
      expect(res.body.data.message).toContain('Based on your profile/data:');
      expect(res.body.data.message).toContain('Alice In Wonderland');
    });

    it('executes tool calling loop when user asks about notifications', async () => {
      const mockNotifRepo = {
        getUserNotifications: vi.fn().mockResolvedValue({
          data: [
            {
              notificationId: 99,
              type: 'LIKE',
              actorUserId: 1002,
              actor: {
                userId: 1002,
                username: 'bob',
                displayName: 'Bob'
              },
              postId: 5,
              isRead: false,
              createdAt: new Date().toISOString()
            }
          ]
        }),
        getUnreadCount: vi.fn().mockResolvedValue(1)
      };
      oracleRepositoryManager.notificationRepo = mockNotifRepo as any;
      postgresRepositoryManager.notificationRepo = mockNotifRepo as any;

      const res = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${userAliceToken}`)
        .send({ message: 'What are my notifications?' });

      expect(res.status).toBe(200);
      expect(res.body.data.message).toContain('Based on your profile/data:');
      expect(res.body.data.message).toContain('unreadCount');
    });
  });
});
