import { Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { getBroadcastRepository, getMessageRepository } from '../repositories/factory.js';
import { realtimeServer } from '../socket.js';
import { sendError } from '../utils/response.js';

export async function createBroadcast(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    const { title, recipientIds, message, content } = req.body;
    const bodyContent = (content || message || '').trim();

    if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
      return sendError(res, 'VALIDATION_ERROR', 'At least one recipient is required for broadcast', 400);
    }

    if (!bodyContent) {
      return sendError(res, 'VALIDATION_ERROR', 'Broadcast message content cannot be empty', 400);
    }

    const messageRepo = getMessageRepository();
    const broadcastRepo = getBroadcastRepository();
    const dispatchedMessages = [];

    // Fan-out: send individual direct message to each recipient
    for (const recipientId of recipientIds) {
      if (recipientId !== currentUserId) {
        const msg = await messageRepo.sendMessage({
          senderId: currentUserId,
          receiverId: recipientId,
          content: bodyContent
        });
        realtimeServer.emitToUser(recipientId, 'message:created', msg);
        dispatchedMessages.push(msg);
      }
    }

    const broadcast = await broadcastRepo.createBroadcast(
      currentUserId,
      recipientIds,
      bodyContent,
      title
    );

    return res.status(201).json({
      data: {
        broadcast,
        messagesCount: dispatchedMessages.length,
        dispatchedMessages
      }
    });
  } catch (error: any) {
    return sendError(res, 'INTERNAL_ERROR', error.message || 'Failed to send broadcast', 500);
  }
}

export async function getUserBroadcasts(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    const broadcastRepo = getBroadcastRepository();
    const broadcasts = await broadcastRepo.getUserBroadcasts(currentUserId);
    return res.json({ data: broadcasts });
  } catch (error: any) {
    return sendError(res, 'INTERNAL_ERROR', error.message || 'Failed to fetch broadcasts', 500);
  }
}
