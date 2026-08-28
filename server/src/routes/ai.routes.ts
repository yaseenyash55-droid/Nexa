import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { validate, validateParams } from '../middleware/validate.middleware.js';
import {
  aiChatSchema,
  aiStreamChatSchema,
  aiConversationParamSchema,
  aiWritingSchema,
  aiPreferencesSchema,
  aiCreateMemorySchema,
  aiMemoryParamSchema,
  aiCreateConversationSchema
} from '../schemas/ai.schema.js';
import {
  getAiStatus,
  handleAiChat,
  handleAiStreamChat,
  listConversations,
  getConversation,
  deleteConversation,
  createConversation,
  handleAiWritingAssistant,
  handleRagIngest,
  handleRagSearch,
  getAiPreferences,
  updateAiPreferences,
  getAiMemories,
  createAiMemory,
  deleteAiMemory,
  clearAiMemories
} from '../controllers/ai.controller.js';

export const aiRouter = Router();

// GET /api/ai/status - Diagnostics (requires auth)
aiRouter.get('/status', requireAuth, getAiStatus);

// POST /api/ai/chat - Standard JSON single/multi-turn chat with DB persistence and RAG
aiRouter.post('/chat', requireAuth, validate(aiChatSchema), handleAiChat);

// POST /api/ai/chat/stream - Server-Sent Events (SSE) streaming chat with DB persistence and RAG
aiRouter.post('/chat/stream', requireAuth, validate(aiStreamChatSchema), handleAiStreamChat);

// POST /api/ai/writing - Dedicated writing operations assistant (improve, caption, grammar, etc.)
aiRouter.post('/writing', requireAuth, validate(aiWritingSchema), handleAiWritingAssistant);

// POST /api/ai/rag/ingest - Ingest approved documentation into RAG knowledge base
aiRouter.post('/rag/ingest', requireAuth, handleRagIngest);

// GET /api/ai/rag/search - Semantic retrieval test / lookup
aiRouter.get('/rag/search', requireAuth, handleRagSearch);

// GET /api/ai/preferences - Retrieve user AI personalization preferences
aiRouter.get('/preferences', requireAuth, getAiPreferences);

// PUT /api/ai/preferences - Update user AI personalization preferences
aiRouter.put('/preferences', requireAuth, validate(aiPreferencesSchema), updateAiPreferences);

// GET /api/ai/memories - View user's AI personalization memories
aiRouter.get('/memories', requireAuth, getAiMemories);

// POST /api/ai/memories - Add new AI personalization memory
aiRouter.post('/memories', requireAuth, validate(aiCreateMemorySchema), createAiMemory);

// DELETE /api/ai/memories - Clear all user's AI memories
aiRouter.delete('/memories', requireAuth, clearAiMemories);

// DELETE /api/ai/memories/:id - Delete individual memory (enforces user authorization)
aiRouter.delete('/memories/:id', requireAuth, validateParams(aiMemoryParamSchema), deleteAiMemory);

// POST /api/ai/conversations - Create a new empty conversation
aiRouter.post('/conversations', requireAuth, validate(aiCreateConversationSchema), createConversation);

// GET /api/ai/conversations - List user's conversations
aiRouter.get('/conversations', requireAuth, listConversations);

// GET /api/ai/conversations/:id - Retrieve conversation & message history (enforces user authorization)
aiRouter.get('/conversations/:id', requireAuth, validateParams(aiConversationParamSchema), getConversation);

// DELETE /api/ai/conversations/:id - Delete a conversation (enforces user authorization)
aiRouter.delete('/conversations/:id', requireAuth, validateParams(aiConversationParamSchema), deleteConversation);
