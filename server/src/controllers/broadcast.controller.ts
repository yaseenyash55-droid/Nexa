import { Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { getBroadcastRepository, getMessageRepository } from '../repositories/factory.js';
import { realtimeServer } from '../socket.js';

export async function createBroadcast(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }

    const { title, recipientIds, message, content } = req.body;
    const bodyContent = (content || message || '').trim();

    if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'At least one recipient is required for broadcast' } });
    }

    if (!bodyContent) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Broadcast message content cannot be empty' } });
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
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to send broadcast' } });
  }
}

export async function getUserBroadcasts(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }

    const broadcastRepo = getBroadcastRepository();
    const broadcasts = await broadcastRepo.getUserBroadcasts(currentUserId);
    return res.json({ data: broadcasts });
  } catch (error: any) {
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to fetch broadcasts' } });
  }
}
