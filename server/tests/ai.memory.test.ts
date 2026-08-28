import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { aiRouter } from '../src/routes/ai.routes.js';
import { oracleRepositoryManager } from '../src/repositories/oracle/oracle.repo.js';
import { postgresRepositoryManager } from '../src/repositories/postgres/postgres.repo.js';
import { OracleAiMemoryRepository } from '../src/repositories/oracle/memory.oracle.repo.js';
import { BaseAIProvider } from '../src/ai/providers/base.provider.js';
import { resetAIProviderForTesting } from '../src/ai/providers/factory.js';
import { ChatMessage, GenerateOptions, GenerateResult } from '../src/types/ai.types.js';

let latestCapturedPrompt = '';

class MockMemoryAIProvider extends BaseAIProvider {
  public readonly name = 'openai';
  public isAvailable(): boolean {
    return true;
  }

  public async generate(_messages: ChatMessage[], options?: GenerateOptions): Promise<GenerateResult> {
    latestCapturedPrompt = options?.systemPrompt || '';
    return {
      text: 'Mock personalized AI response',
      model: options?.model || 'gpt-4o-mini'
    };
  }

  public async stream(): Promise<void> {}
  public async embed(): Promise<any> { return { embeddings: [] }; }
}

// Mock authentication middleware
let authUserId = 1001;
let authUsername = 'alice';

vi.mock('../src/middleware/auth.middleware.js', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { userId: authUserId, username: authUsername };
    next();
  }
}));

// Mock pool checks so repositories run in in-memory / mock safe paths
vi.mock('../src/db/pool.js', () => ({
  isOraclePoolInitialized: () => false,
  executeSql: vi.fn()
}));

vi.mock('../src/db/postgres.pool.js', () => ({
  isPostgresPoolInitialized: () => false,
  executePostgresSql: vi.fn()
}));

const app = express();
app.use(express.json());
app.use('/api/ai', aiRouter);

describe('NEXA AI Personalization & Memory Suite (Phase 10)', () => {
  let memoryRepo: OracleAiMemoryRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    authUserId = 1001;
    authUsername = 'alice';
    latestCapturedPrompt = '';
    resetAIProviderForTesting(new MockMemoryAIProvider());
    memoryRepo = new OracleAiMemoryRepository();
    oracleRepositoryManager.memoryRepo = memoryRepo;
    postgresRepositoryManager.memoryRepo = memoryRepo;
  });

  describe('1. AI Preferences API', () => {
    it('retrieves default personalization preferences for authenticated user', async () => {
      const res = await request(app)
        .get('/api/ai/preferences');

      expect(res.status).toBe(200);
      expect(res.body.data.userId).toBe(1001);
      expect(res.body.data.personalizationEnabled).toBe(true);
      expect(res.body.data.preferredLanguage).toBe('English');
      expect(res.body.data.responseLength).toBe('balanced');
    });

    it('updates personalization preferences (e.g. toggle personalization OFF)', async () => {
      const res = await request(app)
        .put('/api/ai/preferences')
        .send({
          personalizationEnabled: false,
          preferredLanguage: 'Spanish',
          responseLength: 'concise',
          writingTone: 'technical'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.personalizationEnabled).toBe(false);
      expect(res.body.data.preferredLanguage).toBe('Spanish');
      expect(res.body.data.responseLength).toBe('concise');
      expect(res.body.data.writingTone).toBe('technical');
    });

    it('rejects invalid preference values with 400', async () => {
      const res = await request(app)
        .put('/api/ai/preferences')
        .send({
          responseLength: 'ultra_mega_long' // invalid enum
        });

      expect(res.status).toBe(400);
    });
  });

  describe('2. AI Memory Management API', () => {
    it('creates a new memory preference item for authenticated user', async () => {
      const res = await request(app)
        .post('/api/ai/memories')
        .send({
          keyName: 'Preferred Framework',
          content: 'I primarily code in React with TypeScript and strict null checks.',
          category: 'technical'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.keyName).toBe('Preferred Framework');
      expect(res.body.data.content).toContain('React with TypeScript');
      expect(res.body.data.userId).toBe(1001);
    });

    it('validates memory creation bounds (rejects empty or overly long keys)', async () => {
      const res = await request(app)
        .post('/api/ai/memories')
        .send({
          keyName: '',
          content: 'Some preference'
        });

      expect(res.status).toBe(400);
    });

    it('lists memories owned by the authenticated user', async () => {
      const mockMemories = [
        {
          memoryId: 101,
          userId: 1001,
          keyName: 'Language Style',
          content: 'Speak in concise bullet points.',
          category: 'writing_style',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const mockRepo = {
        getMemories: vi.fn().mockResolvedValue(mockMemories)
      };
      oracleRepositoryManager.memoryRepo = mockRepo as any;
      postgresRepositoryManager.memoryRepo = mockRepo as any;

      const res = await request(app).get('/api/ai/memories');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].keyName).toBe('Language Style');
      expect(mockRepo.getMemories).toHaveBeenCalledWith(1001);
    });

    it('clears all memories owned by the user', async () => {
      const mockRepo = {
        clearAllMemories: vi.fn().mockResolvedValue(3)
      };
      oracleRepositoryManager.memoryRepo = mockRepo as any;
      postgresRepositoryManager.memoryRepo = mockRepo as any;

      const res = await request(app).delete('/api/ai/memories');

      expect(res.status).toBe(200);
      expect(res.body.data.clearedCount).toBe(3);
      expect(mockRepo.clearAllMemories).toHaveBeenCalledWith(1001);
    });
  });

  describe('3. Cross-User Authorization & Security Boundaries', () => {
    it('prevents user A (1001) from deleting a memory owned by user B (1002)', async () => {
      // Memory 202 belongs to user 1002 (Bob)
      const mockRepo = {
        getMemoryById: vi.fn().mockResolvedValue(null), // scoped to (memoryId, userId)
        deleteMemory: vi.fn()
      };
      oracleRepositoryManager.memoryRepo = mockRepo as any;
      postgresRepositoryManager.memoryRepo = mockRepo as any;

      // Alice (1001) attempts to delete memory 202
      const res = await request(app).delete('/api/ai/memories/202');

      expect(res.status).toBe(403);
      expect(mockRepo.getMemoryById).toHaveBeenCalledWith(202, 1001);
      expect(mockRepo.deleteMemory).not.toHaveBeenCalled();
    });

    it('allows owner to delete their own memory item', async () => {
      const mockRepo = {
        getMemoryById: vi.fn().mockResolvedValue({
          memoryId: 301,
          userId: 1001,
          keyName: 'Favorite Topic',
          content: 'Space exploration'
        }),
        deleteMemory: vi.fn().mockResolvedValue(true)
      };
      oracleRepositoryManager.memoryRepo = mockRepo as any;
      postgresRepositoryManager.memoryRepo = mockRepo as any;

      const res = await request(app).delete('/api/ai/memories/301');

      expect(res.status).toBe(200);
      expect(mockRepo.deleteMemory).toHaveBeenCalledWith(301, 1001);
    });
  });

  describe('4. Prompt Personalization Injection', () => {
    it('injects user memory context into system prompt when personalization is ON', async () => {
      const mockMemoryRepo = {
        getPreferences: vi.fn().mockResolvedValue({
          userId: 1001,
          personalizationEnabled: true,
          preferredLanguage: 'French',
          responseLength: 'concise',
          writingTone: 'technical',
          createdAt: new Date(),
          updatedAt: new Date()
        }),
        getMemories: vi.fn().mockResolvedValue([
          {
            memoryId: 1,
            userId: 1001,
            keyName: 'Programming Stack',
            content: 'Node.js and Oracle SQL',
            category: 'technical'
          }
        ])
      };
      oracleRepositoryManager.memoryRepo = mockMemoryRepo as any;
      postgresRepositoryManager.memoryRepo = mockMemoryRepo as any;

      const mockAiRepo = {
        getConversationById: vi.fn().mockResolvedValue({
          conversationId: 50,
          userId: 1001,
          title: 'Personalized Chat',
          createdAt: new Date(),
          updatedAt: new Date()
        }),
        getConversationMessages: vi.fn().mockResolvedValue([]),
        saveMessage: vi.fn().mockResolvedValue({ messageId: 1 }),
        touchConversation: vi.fn().mockResolvedValue(undefined)
      };
      oracleRepositoryManager.aiRepo = mockAiRepo as any;
      postgresRepositoryManager.aiRepo = mockAiRepo as any;

      const res = await request(app)
        .post('/api/ai/chat')
        .send({
          message: 'Can you help me design a data model?',
          conversationId: 50
        });

      expect(res.status).toBe(200);
      expect(latestCapturedPrompt).toContain('Preferred Language: French');
      expect(latestCapturedPrompt).toContain('Response Length: concise');
      expect(latestCapturedPrompt).toContain('Programming Stack: Node.js and Oracle SQL');
      expect(latestCapturedPrompt).toContain('User Personalization Context - Owned by User 1001');
    });

    it('does NOT inject user memory context when personalization is toggled OFF', async () => {
      const mockMemoryRepo = {
        getPreferences: vi.fn().mockResolvedValue({
          userId: 1001,
          personalizationEnabled: false, // Personalization OFF
          preferredLanguage: 'French',
          responseLength: 'concise',
          writingTone: 'technical',
          createdAt: new Date(),
          updatedAt: new Date()
        }),
        getMemories: vi.fn().mockResolvedValue([
          {
            memoryId: 1,
            userId: 1001,
            keyName: 'Secret Detail',
            content: 'Should not appear',
            category: 'general'
          }
        ])
      };
      oracleRepositoryManager.memoryRepo = mockMemoryRepo as any;
      postgresRepositoryManager.memoryRepo = mockMemoryRepo as any;

      const mockAiRepo = {
        getConversationById: vi.fn().mockResolvedValue({
          conversationId: 50,
          userId: 1001,
          title: 'Chat',
          createdAt: new Date(),
          updatedAt: new Date()
        }),
        getConversationMessages: vi.fn().mockResolvedValue([]),
        saveMessage: vi.fn().mockResolvedValue({ messageId: 1 }),
        touchConversation: vi.fn().mockResolvedValue(undefined)
      };
      oracleRepositoryManager.aiRepo = mockAiRepo as any;
      postgresRepositoryManager.aiRepo = mockAiRepo as any;

      const res = await request(app)
        .post('/api/ai/chat')
        .send({
          message: 'Hello!',
          conversationId: 50
        });

      expect(res.status).toBe(200);
      expect(latestCapturedPrompt).not.toContain('User Personalization Context');
      expect(latestCapturedPrompt).not.toContain('Secret Detail');
    });
  });
});
