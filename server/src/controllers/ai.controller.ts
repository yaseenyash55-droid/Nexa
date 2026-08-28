import { Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { aiService } from '../ai/ai.service.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export async function getAiStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const status = aiService.getStatus();
    return sendSuccess(res, status);
  } catch (err: any) {
    logger.error({ err: err?.message || err }, 'Failed to get AI status');
    return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve AI status', 500);
  }
}

export async function handleAiChat(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { message, conversationId } = req.body;

    const result = await aiService.chat(userId, message, conversationId);

    return sendSuccess(res, result, 'AI response generated successfully');
  } catch (err: any) {
    if (err.message === 'CONVERSATION_FORBIDDEN_OR_NOT_FOUND') {
      return sendError(res, 'FORBIDDEN', 'Conversation not found or you do not have permission to access it', 403);
    }
    if (err.message === 'AI_DISABLED') {
      return sendError(res, 'SERVICE_UNAVAILABLE', 'NEXA AI assistant is currently disabled on this server', 503);
    }
    if (err.message === 'AI_PROVIDER_UNAVAILABLE') {
      return sendError(res, 'SERVICE_UNAVAILABLE', 'NEXA AI assistant is not configured with an active provider', 503);
    }
    if (err.message?.includes('credentials rejected') || err.message?.includes('authentication')) {
      return sendError(res, 'AI_AUTH_ERROR', 'AI service credentials rejected by upstream provider', 502);
    }
    if (err.message?.includes('rate limit')) {
      return sendError(res, 'TOO_MANY_REQUESTS', 'AI rate limit reached. Please try again shortly.', 429);
    }

    logger.error({ err: err?.message || err, userId: req.user?.userId }, 'AI chat generation failed');
    return sendError(res, 'AI_ERROR', err.message || 'AI request failed', 500);
  }
}

export async function handleAiStreamChat(req: AuthenticatedRequest, res: Response) {
  let isClosed = false;
  let timeoutTimer: NodeJS.Timeout | null = null;

  try {
    const userId = req.user!.userId;
    const { message, conversationId } = req.body;

    const status = aiService.getStatus();
    if (!status.enabled || !status.available) {
      return sendError(
        res,
        'SERVICE_UNAVAILABLE',
        'NEXA AI assistant is currently unavailable on this server',
        503
      );
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    req.on('close', () => {
      isClosed = true;
      if (timeoutTimer) clearTimeout(timeoutTimer);
    });

    timeoutTimer = setTimeout(() => {
      if (!isClosed) {
        isClosed = true;
        res.write(`event: error\ndata: ${JSON.stringify({ error: 'Streaming response timed out' })}\n\n`);
        res.end();
      }
    }, 45000);

    const conv = await aiService.getOrCreateConversation(userId, conversationId, message);
    const activeConvId = conv.conversationId;

    await aiService.streamChat(
      userId,
      message,
      {
        onChunk: (chunk: string) => {
          if (!isClosed) {
            res.write(`event: chunk\ndata: ${JSON.stringify({ chunk })}\n\n`);
          }
        },
        onComplete: async (fullText: string) => {
          if (timeoutTimer) clearTimeout(timeoutTimer);
          if (!isClosed) {
            res.write(`event: complete\ndata: ${JSON.stringify({ message: fullText, conversationId: activeConvId })}\n\n`);
            res.end();
          }
        },
        onError: (err: Error) => {
          if (timeoutTimer) clearTimeout(timeoutTimer);
          if (!isClosed) {
            res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
            res.end();
          }
        }
      },
      activeConvId
    );
  } catch (err: any) {
    if (timeoutTimer) clearTimeout(timeoutTimer);
    if (!res.headersSent) {
      if (err.message === 'CONVERSATION_FORBIDDEN_OR_NOT_FOUND') {
        return sendError(res, 'FORBIDDEN', 'Conversation not found or access denied', 403);
      }
      if (err.message === 'AI_DISABLED' || err.message === 'AI_PROVIDER_UNAVAILABLE') {
        return sendError(res, 'SERVICE_UNAVAILABLE', 'AI assistant is currently unavailable', 503);
      }
      return sendError(res, 'AI_STREAM_ERROR', err.message || 'Streaming failed', 500);
    }
    if (!isClosed) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: err.message || 'Stream generation failed' })}\n\n`);
      res.end();
    }
  }
}

export async function listConversations(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const conversations = await aiService.listUserConversations(userId);
    return sendSuccess(res, conversations);
  } catch (err: any) {
    logger.error({ err: err?.message || err, userId: req.user?.userId }, 'Failed to list AI conversations');
    return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve AI conversations', 500);
  }
}

export async function createConversation(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { title } = req.body || {};

    const conversation = await aiService.getOrCreateConversation(userId, undefined, title);
    return sendSuccess(res, conversation, 'AI conversation created successfully');
  } catch (err: any) {
    logger.error({ err: err?.message || err, userId: req.user?.userId }, 'Failed to create AI conversation');
    return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to create AI conversation', 500);
  }
}

export async function getConversation(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const conversationId = Number(req.params.id);

    const details = await aiService.getConversationDetails(conversationId, userId);
    return sendSuccess(res, details);
  } catch (err: any) {
    if (err.message === 'CONVERSATION_FORBIDDEN_OR_NOT_FOUND') {
      return sendError(res, 'NOT_FOUND', 'Conversation not found or access denied', 404);
    }
    logger.error({ err: err?.message || err, userId: req.user?.userId }, 'Failed to get AI conversation details');
    return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve conversation details', 500);
  }
}

export async function deleteConversation(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const conversationId = Number(req.params.id);

    const deleted = await aiService.deleteConversation(conversationId, userId);
    if (!deleted) {
      return sendError(res, 'NOT_FOUND', 'Conversation not found or access denied', 404);
    }

    return sendSuccess(res, { success: true }, 'Conversation deleted successfully');
  } catch (err: any) {
    logger.error({ err: err?.message || err, userId: req.user?.userId }, 'Failed to delete AI conversation');
    return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to delete AI conversation', 500);
  }
}

import { ragIngestionService } from '../ai/rag/ingestion.service.js';
import { ragRetriever } from '../ai/rag/retriever.js';

export async function handleAiWritingAssistant(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { operation, text, targetLanguage } = req.body;

    const result = await aiService.generateWritingAssistant(
      userId,
      operation,
      text || '',
      targetLanguage
    );

    return sendSuccess(res, result, 'Writing assistant output generated');
  } catch (err: any) {
    if (err.message === 'AI_PROVIDER_UNAVAILABLE') {
      return sendError(res, 'SERVICE_UNAVAILABLE', 'AI assistant is currently unavailable or disabled', 503);
    }
    if (err.statusCode && err.statusCode < 500) {
      return sendError(res, 'BAD_REQUEST', err.message || 'Invalid writing operation request', err.statusCode);
    }
    logger.error({ err: err?.message || err, userId: req.user?.userId }, 'AI Writing Assistant generation failed');
    return sendError(res, 'BAD_GATEWAY', 'Failed to process AI writing assistant request', 502);
  }
}

export async function handleRagIngest(req: AuthenticatedRequest, res: Response) {
  try {
    const result = await ragIngestionService.ingestAllApprovedDocs();
    return sendSuccess(res, result, 'Approved documentation ingested into RAG knowledge base');
  } catch (err: any) {
    logger.error({ err: err?.message || err, userId: req.user?.userId }, 'RAG ingestion failed');
    return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to ingest documentation', 500);
  }
}

export async function handleRagSearch(req: AuthenticatedRequest, res: Response) {
  try {
    const query = req.query.q as string;
    if (!query || !query.trim()) {
      return sendError(res, 'BAD_REQUEST', 'Query parameter "q" is required', 400);
    }

    const results = await ragRetriever.retrieve(query.trim(), { topK: 5 });
    return sendSuccess(res, results, 'RAG search results retrieved');
  } catch (err: any) {
    logger.error({ err: err?.message || err, userId: req.user?.userId }, 'RAG search failed');
    return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve documentation search results', 500);
  }
}

export async function getAiPreferences(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const prefs = await aiService.getUserPreferences(userId);
    return sendSuccess(res, prefs);
  } catch (err: any) {
    logger.error({ err: err?.message || err, userId: req.user?.userId }, 'Failed to get AI preferences');
    return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve AI preferences', 500);
  }
}

export async function updateAiPreferences(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const updated = await aiService.updateUserPreferences(userId, req.body);
    return sendSuccess(res, updated, 'AI preferences updated');
  } catch (err: any) {
    logger.error({ err: err?.message || err, userId: req.user?.userId }, 'Failed to update AI preferences');
    return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to update AI preferences', 500);
  }
}

export async function getAiMemories(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const memories = await aiService.getUserMemories(userId);
    return sendSuccess(res, memories);
  } catch (err: any) {
    logger.error({ err: err?.message || err, userId: req.user?.userId }, 'Failed to get AI memories');
    return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve AI memories', 500);
  }
}

export async function createAiMemory(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const { keyName, content, category } = req.body;
    const created = await aiService.createMemory(userId, keyName, content, category);
    return sendSuccess(res, created, 'AI memory created', undefined, 201);
  } catch (err: any) {
    logger.error({ err: err?.message || err, userId: req.user?.userId }, 'Failed to create AI memory');
    return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to create AI memory', 500);
  }
}

export async function deleteAiMemory(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const memoryId = Number(req.params.id);
    await aiService.deleteMemory(memoryId, userId);
    return sendSuccess(res, { deleted: true }, 'AI memory deleted');
  } catch (err: any) {
    if (err.message === 'MEMORY_FORBIDDEN_OR_NOT_FOUND') {
      return sendError(res, 'FORBIDDEN', 'Memory not found or access denied', 403);
    }
    logger.error({ err: err?.message || err, userId: req.user?.userId }, 'Failed to delete AI memory');
    return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to delete AI memory', 500);
  }
}

export async function clearAiMemories(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const count = await aiService.clearAllMemories(userId);
    return sendSuccess(res, { clearedCount: count }, 'All AI memories cleared');
  } catch (err: any) {
    logger.error({ err: err?.message || err, userId: req.user?.userId }, 'Failed to clear AI memories');
    return sendError(res, 'INTERNAL_SERVER_ERROR', 'Failed to clear AI memories', 500);
  }
}
