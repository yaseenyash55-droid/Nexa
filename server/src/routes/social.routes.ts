import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { getStoryRepository, getReelRepository, getMessageRepository } from '../repositories/factory.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { realtimeServer } from '../socket.js';

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
  const matches = base64Data.match(/^data:image\/([a-zA-Z0-9\+\/]+);base64,(.+)$/);
  if (!matches) return base64Data;

  const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
  const buffer = Buffer.from(matches[2], 'base64');

  const uploadDir = path.join(process.cwd(), 'uploads', 'posts');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const filename = `story-${userId}-${Date.now()}.${ext}`;
  const filePath = path.join(uploadDir, filename);
  fs.writeFileSync(filePath, buffer);

  return `/uploads/posts/${filename}`;
}

socialRouter.post('/stories', requireAuth, async (req: any, res, next) => {
  try {
    let { mediaUrl, caption } = req.body;
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
      caption
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

import fs from 'fs';
import path from 'path';

function saveBase64ReelToDisk(base64Data: string, userId: number): string {
  if (!base64Data || !base64Data.startsWith('data:video/')) {
    return base64Data;
  }
  const matches = base64Data.match(/^data:video\/([a-zA-Z0-9\+\/-]+);base64,(.+)$/);
  if (!matches) return base64Data;

  let ext = 'mp4';
  if (matches[1].includes('webm')) ext = 'webm';
  else if (matches[1].includes('quicktime')) ext = 'mov';

  const buffer = Buffer.from(matches[2], 'base64');
  const uploadDir = path.join(process.cwd(), 'uploads', 'videos');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const filename = `reel-${userId}-${Date.now()}.${ext}`;
  const filePath = path.join(uploadDir, filename);
  fs.writeFileSync(filePath, buffer);

  return `/uploads/videos/${filename}`;
}

socialRouter.post('/reels', requireAuth, async (req: any, res, next) => {
  try {
    let { videoUrl, caption } = req.body;
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
    if (repo.deleteReel) {
      await repo.deleteReel(reelId, req.user.userId);
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
    const { receiverId, content } = req.body;
    if (!receiverId || !content) {
      return sendError(res, 'INVALID_INPUT', 'Receiver ID and content are required', 400);
    }
    const msg = await getMessageRepository().sendMessage({
      senderId: req.user.userId,
      receiverId,
      content
    });
    realtimeServer.emitToUser(receiverId, 'message:created', msg);
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
