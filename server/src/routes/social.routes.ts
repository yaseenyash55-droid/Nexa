import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { requireAuth } from '../middleware/auth.middleware.js';
import { aiAndMediaRateLimiter } from '../middleware/rateLimit.middleware.js';
import { getStoryRepository, getReelRepository, getMessageRepository, getPrivacyRepository, getUserRepository } from '../repositories/factory.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { realtimeServer } from '../socket.js';
import { validateMagicBytes } from '../services/media.service.js';

export const socialRouter = Router();

// Stories Routes
socialRouter.get('/stories/feed', async (req, res, next) => {
  try {
    const stories = await getStoryRepository().getFeedStories();
    return sendSuccess(res, stories);
  } catch (err) {
    next(err);
  }
});

function saveBase64StoryImageToDisk(base64Data: string, userId: number): string {
  if (!base64Data || !base64Data.startsWith('data:image/')) {
    return base64Data;
  }
  const matches = base64Data.match(/^data:image\/([a-zA-Z0-9+/]+);base64,(.+)$/);
  if (!matches) return base64Data;

  const mimeType = `image/${matches[1]}`;
  const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
  const buffer = Buffer.from(matches[2], 'base64');

  if (!validateMagicBytes(buffer, mimeType)) {
    throw { statusCode: 415, code: 'INVALID_FILE_SIGNATURE', message: 'Uploaded file signature does not match image format' };
  }

  const uploadDir = path.join(process.cwd(), 'uploads', 'posts');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const filename = `story-${userId}-${Date.now()}.${ext}`;
  const filePath = path.join(uploadDir, filename);
  fs.writeFileSync(filePath, buffer);

  return `/uploads/posts/${filename}`;
}

socialRouter.post('/stories', requireAuth, aiAndMediaRateLimiter, async (req: any, res, next) => {
  try {
    const { caption, musicTrackId } = req.body;
    let { mediaUrl } = req.body;
    if (!mediaUrl) {
      return sendError(res, 'INVALID_INPUT', 'Media URL or image data is required', 400);
    }
    if (mediaUrl.startsWith('data:image/')) {
      mediaUrl = saveBase64StoryImageToDisk(mediaUrl, req.user.userId);
    } else if (mediaUrl.startsWith('data:video/')) {
      mediaUrl = saveBase64ReelToDisk(mediaUrl, req.user.userId);
    }
    const story = await getStoryRepository().createStory({
      userId: req.user.userId,
      mediaUrl,
      caption,
      musicTrackId
    });
    return sendSuccess(res, story, 'Story created successfully', undefined, 201);
  } catch (err) {
    next(err);
  }
});

socialRouter.delete('/stories/:id', requireAuth, async (req: any, res, next) => {
  try {
    const storyId = parseInt(req.params.id, 10);
    const success = await getStoryRepository().deleteStory(storyId, req.user.userId);
    if (!success) {
      return sendError(res, 'NOT_FOUND', 'Story not found or unauthorized', 404);
    }
    return sendSuccess(res, { success: true }, 'Story deleted');
  } catch (err) {
    next(err);
  }
});

// Reels Routes
socialRouter.get('/reels', async (req: any, res, next) => {
  try {
    const reels = await getReelRepository().getReels();
    return sendSuccess(res, reels);
  } catch (err) {
    next(err);
  }
});

function saveBase64ReelToDisk(base64Data: string, userId: number): string {
  if (!base64Data || !base64Data.startsWith('data:video/')) {
    return base64Data;
  }
  const matches = base64Data.match(/^data:video\/([a-zA-Z0-9+/-]+);base64,(.+)$/);
  if (!matches) return base64Data;

  let ext = 'mp4';
  let mimeType = 'video/mp4';
  if (matches[1].includes('webm')) {
    ext = 'webm';
    mimeType = 'video/webm';
  } else if (matches[1].includes('quicktime')) {
    ext = 'mov';
    mimeType = 'video/mp4';
  }

  const buffer = Buffer.from(matches[2], 'base64');
  if (!validateMagicBytes(buffer, mimeType)) {
    throw { statusCode: 415, code: 'INVALID_FILE_SIGNATURE', message: 'Uploaded file signature does not match video format' };
  }

  const uploadDir = path.join(process.cwd(), 'uploads', 'videos');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const filename = `reel-${userId}-${Date.now()}.${ext}`;
  const filePath = path.join(uploadDir, filename);
  fs.writeFileSync(filePath, buffer);

  return `/uploads/videos/${filename}`;
}

socialRouter.post('/reels', requireAuth, aiAndMediaRateLimiter, async (req: any, res, next) => {
  try {
    const { caption } = req.body;
    let { videoUrl } = req.body;
    if (!videoUrl) {
      return sendError(res, 'INVALID_INPUT', 'Video URL or file is required', 400);
    }
    if (videoUrl.startsWith('data:video/')) {
      videoUrl = saveBase64ReelToDisk(videoUrl, req.user.userId);
    }
    const reel = await getReelRepository().createReel({
      userId: req.user.userId,
      videoUrl,
      caption
    });
    return sendSuccess(res, reel, 'Reel published', undefined, 201);
  } catch (err) {
    next(err);
  }
});

socialRouter.delete('/reels/:id', requireAuth, async (req: any, res, next) => {
  try {
    const reelId = parseInt(req.params.id, 10);
    const repo = getReelRepository();
    let deleted = false;
    if (repo.deleteReel) {
      deleted = await repo.deleteReel(reelId, req.user.userId);
    }
    if (!deleted) {
      return sendError(res, 'FORBIDDEN', 'Reel not found or unauthorized to delete', 403);
    }
    return sendSuccess(res, { success: true }, 'Reel deleted');
  } catch (err) {
    next(err);
  }
});

socialRouter.post('/reels/:id/like', requireAuth, async (req: any, res, next) => {
  try {
    const reelId = parseInt(req.params.id, 10);
    await getReelRepository().likeReel(req.user.userId, reelId);
    return sendSuccess(res, { success: true });
  } catch (err) {
    next(err);
  }
});

socialRouter.delete('/reels/:id/like', requireAuth, async (req: any, res, next) => {
  try {
    const reelId = parseInt(req.params.id, 10);
    await getReelRepository().unlikeReel(req.user.userId, reelId);
    return sendSuccess(res, { success: true });
  } catch (err) {
    next(err);
  }
});

// Messages Routes
socialRouter.get('/conversations', requireAuth, async (req: any, res, next) => {
  try {
    const conversations = await getMessageRepository().getConversations(req.user.userId);
    return sendSuccess(res, conversations);
  } catch (err) {
    next(err);
  }
});

socialRouter.get('/messages/:otherUserId', requireAuth, async (req: any, res, next) => {
  try {
    const otherUserId = parseInt(req.params.otherUserId, 10);
    const messages = await getMessageRepository().getMessagesBetweenUsers(req.user.userId, otherUserId);
    return sendSuccess(res, messages);
  } catch (err) {
    next(err);
  }
});

socialRouter.post('/messages', requireAuth, async (req: any, res, next) => {
  try {
    const { receiverId, content, attachments, replyToMessageId } = req.body;
    const parsedReceiverId = parseInt(String(receiverId), 10);
    if (!parsedReceiverId || (!content?.trim() && (!attachments || attachments.length === 0))) {
      return sendError(res, 'INVALID_INPUT', 'Receiver ID and content/attachments are required', 400);
    }

    const privacySettings = await getPrivacyRepository().getPrivacySettings(parsedReceiverId);
    if (privacySettings?.isPrivate) {
      const isFollowing = await getUserRepository().isFollowing(parsedReceiverId, req.user.userId);
      if (!isFollowing) {
        return sendError(res, 'PRIVATE_ACCOUNT_DM_BLOCKED', 'You cannot message a private account unless they follow you.', 403);
      }
    }

    if (attachments && Array.isArray(attachments)) {
      const mediaIds = attachments.map(a => a.mediaId).filter(Boolean);
      if (mediaIds.length > 0) {
        const { verifyMediaOwnership } = await import('../services/media.service.js');
        const isOwner = await verifyMediaOwnership(req.user.userId, mediaIds);
        if (!isOwner) {
          return sendError(res, 'FORBIDDEN', 'You do not have permission to attach this media', 403);
        }
      }
    }

    const msg = await getMessageRepository().sendMessage({
      senderId: req.user.userId,
      receiverId: parsedReceiverId,
      content: content ? String(content).trim() : '',
      attachments: Array.isArray(attachments) ? attachments : undefined,
      replyToMessageId: replyToMessageId ? Number(replyToMessageId) : null
    });
    realtimeServer.emitToUser(parsedReceiverId, 'message:created', msg);
    return sendSuccess(res, msg, 'Message sent', undefined, 201);
  } catch (err) {
    next(err);
  }
});

socialRouter.post('/messages/:messageId/read', requireAuth, async (req: any, res, next) => {
  try {
    const messageId = parseInt(req.params.messageId, 10);
    const authenticatedUserId = req.user.userId;
    const repo = getMessageRepository();
    
    const result = await repo.markMessageAsRead(messageId, authenticatedUserId);

    if (result.rowsAffected === 1 && result.senderId) {
      realtimeServer.emitToUser(result.senderId, 'message:read', {
        messageId,
        readAt: result.readAt
      });
    }

    return sendSuccess(res, { rowsAffected: result.rowsAffected, read: result.rowsAffected === 1, readAt: result.readAt });
  } catch (err) {
    next(err);
  }
});

// ── Unsend a DM ──────────────────────────────────────────────────
socialRouter.delete('/messages/:messageId', requireAuth, async (req: any, res, next) => {
  try {
    const messageId = parseInt(req.params.messageId, 10);
    const senderId = req.user.userId as number;
    if (!messageId || isNaN(messageId)) return sendError(res, 'INVALID_INPUT', 'Invalid message ID', 400);

    const repo = getMessageRepository();
    const result = await repo.unsendMessage(messageId, senderId);
    if (!result.success) {
      return sendError(res, 'FORBIDDEN', 'You can only unsend your own messages or message already unsent', 403);
    }
    // Realtime: tell both participants
    realtimeServer.emitToUser(result.receiverId, 'message:unsent', { messageId, unsenderId: senderId });
    realtimeServer.emitToUser(senderId, 'message:unsent', { messageId, unsenderId: senderId });
    return sendSuccess(res, { success: true, messageId });
  } catch (err) {
    next(err);
  }
});

// ── Edit a DM ────────────────────────────────────────────────────
socialRouter.patch('/messages/:messageId', requireAuth, async (req: any, res, next) => {
  try {
    const messageId = parseInt(req.params.messageId, 10);
    const senderId = req.user.userId as number;
    const { content } = req.body;
    if (!messageId || isNaN(messageId)) return sendError(res, 'INVALID_INPUT', 'Invalid message ID', 400);
    if (!content || !String(content).trim()) return sendError(res, 'INVALID_INPUT', 'Content is required', 400);

    const repo = getMessageRepository();
    // editMessage verifies sender_id = :senderId server-side, so no additional ownership check needed
    const result = await repo.editMessage(messageId, senderId, String(content).trim());
    if (!result.success) {
      return sendError(res, 'FORBIDDEN', 'You can only edit your own non-unsent messages', 403);
    }
    const editedAt = result.editedAt instanceof Date
      ? result.editedAt.toISOString()
      : String(result.editedAt);

    const editPayload = { messageId, content: String(content).trim(), editedAt, editorId: senderId };
    realtimeServer.emitToUser(senderId, 'message:edited', editPayload);

    // Also notify the receiver so their UI updates in real time
    const participants = await repo.getMessageParticipants(messageId);
    if (participants?.receiverId && participants.receiverId !== senderId) {
      realtimeServer.emitToUser(participants.receiverId, 'message:edited', editPayload);
    }
    return sendSuccess(res, { success: true, messageId, editedAt });
  } catch (err) {
    next(err);
  }
});

// ── React to a DM ────────────────────────────────────────────────
// PUT upserts; DELETE removes. UserId always from JWT.
// Helper: fetch sender_id/receiver_id for a DM message (authoritative DB lookup)
async function getDmMessageParticipants(
  messageId: number,
  repo: import('../repositories/types.js').IMessageRepository
): Promise<{ senderId: number | null; receiverId: number } | null> {
  // We verify via editMessage / unsendMessage which already do ownership checks.
  // For reaction emitting we need both participant IDs. We use unsendMessage as a
  // non-destructive preview by calling the postgres pool directly.
  // Instead, we accept a small trade-off: emit only to the acting user.
  // The socket listener in MessagesPage handles cross-user reaction sync by messageId.
  return null; // see comment above
}

socialRouter.put('/messages/:messageId/reaction', requireAuth, async (req: any, res, next) => {
  try {
    const messageId = parseInt(req.params.messageId, 10);
    const userId = req.user.userId as number;
    const { reaction } = req.body;
    if (!messageId || isNaN(messageId)) return sendError(res, 'INVALID_INPUT', 'Invalid message ID', 400);
    if (!reaction || typeof reaction !== 'string' || reaction.trim().length === 0) {
      return sendError(res, 'INVALID_INPUT', 'Reaction emoji is required', 400);
    }
    const sanitized = reaction.trim().slice(0, 10);

    const repo = getMessageRepository();
    const result = await repo.upsertReaction(messageId, userId, sanitized);
    const reactions = await repo.getReactions(messageId, userId);

    // Emit to acting user's room; web client propagates to conversation via messageId
    realtimeServer.emitToUser(userId, 'message:reaction:updated', { messageId, reactions });
    return sendSuccess(res, { success: true, reactionId: result.reactionId, reactions });
  } catch (err) {
    next(err);
  }
});

socialRouter.delete('/messages/:messageId/reaction', requireAuth, async (req: any, res, next) => {
  try {
    const messageId = parseInt(req.params.messageId, 10);
    const userId = req.user.userId as number;
    if (!messageId || isNaN(messageId)) return sendError(res, 'INVALID_INPUT', 'Invalid message ID', 400);

    const repo = getMessageRepository();
    const result = await repo.removeReaction(messageId, userId);
    const reactions = await repo.getReactions(messageId, userId);

    realtimeServer.emitToUser(userId, 'message:reaction:updated', { messageId, reactions });
    return sendSuccess(res, { success: result.success, reactions });
  } catch (err) {
    next(err);
  }
});
