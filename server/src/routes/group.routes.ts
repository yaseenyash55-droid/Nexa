import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  createGroup,
  getUserGroups,
  getGroupById,
  getGroupMembers,
  getGroupMessages,
  sendGroupMessage,
  addGroupMembers,
  removeGroupMember,
  leaveGroup,
  updateGroupSettings,
  deleteGroup
} from '../controllers/group.controller.js';
import { getGroupRepository } from '../repositories/factory.js';
import { realtimeServer } from '../socket.js';
import { sendSuccess, sendError } from '../utils/response.js';

export const groupRouter = Router();

groupRouter.use(requireAuth);

groupRouter.post('/', createGroup);
groupRouter.get('/', getUserGroups);
groupRouter.get('/:id', getGroupById);
groupRouter.delete('/:id', deleteGroup);
groupRouter.patch('/:id/settings', updateGroupSettings);
groupRouter.get('/:id/members', getGroupMembers);
groupRouter.post('/:id/members', addGroupMembers);
groupRouter.delete('/:id/members/:userId', removeGroupMember);
groupRouter.post('/:id/leave', leaveGroup);
groupRouter.get('/:id/messages', getGroupMessages);
groupRouter.post('/:id/messages', sendGroupMessage);

// ── Unsend a group message ───────────────────────────────────────
groupRouter.delete('/:id/messages/:messageId', async (req: any, res, next) => {
  try {
    const groupId = parseInt(req.params.id, 10);
    const messageId = parseInt(req.params.messageId, 10);
    const senderId = req.user.userId as number;
    if (isNaN(groupId) || isNaN(messageId)) return sendError(res, 'INVALID_INPUT', 'Invalid IDs', 400);

    const repo = getGroupRepository();
    const isMember = await repo.isGroupMember(groupId, senderId);
    if (!isMember) return sendError(res, 'FORBIDDEN', 'Not a group member', 403);

    const result = await repo.unsendGroupMessage(messageId, senderId, groupId);
    if (!result.success) return sendError(res, 'FORBIDDEN', 'You can only unsend your own messages', 403);

    const members = await repo.getGroupMembers(groupId);
    for (const m of members) {
      realtimeServer.emitToUser(m.userId, 'group:message:unsent', { groupId, messageId, unsenderId: senderId });
    }
    return sendSuccess(res, { success: true, messageId });
  } catch (err) {
    next(err);
  }
});

// ── Edit a group message ─────────────────────────────────────────
groupRouter.patch('/:id/messages/:messageId', async (req: any, res, next) => {
  try {
    const groupId = parseInt(req.params.id, 10);
    const messageId = parseInt(req.params.messageId, 10);
    const senderId = req.user.userId as number;
    const { content } = req.body;
    if (isNaN(groupId) || isNaN(messageId)) return sendError(res, 'INVALID_INPUT', 'Invalid IDs', 400);
    if (!content || !String(content).trim()) return sendError(res, 'INVALID_INPUT', 'Content is required', 400);

    const repo = getGroupRepository();
    const isMember = await repo.isGroupMember(groupId, senderId);
    if (!isMember) return sendError(res, 'FORBIDDEN', 'Not a group member', 403);

    const result = await repo.editGroupMessage(messageId, senderId, groupId, String(content).trim());
    if (!result.success) return sendError(res, 'FORBIDDEN', 'You can only edit your own non-unsent messages', 403);

    const editedAt = result.editedAt instanceof Date
      ? result.editedAt.toISOString()
      : String(result.editedAt);

    const members = await repo.getGroupMembers(groupId);
    for (const m of members) {
      realtimeServer.emitToUser(m.userId, 'group:message:edited', {
        groupId, messageId,
        content: String(content).trim(),
        editedAt, editorId: senderId
      });
    }
    return sendSuccess(res, { success: true, messageId, editedAt });
  } catch (err) {
    next(err);
  }
});

// ── React to a group message ─────────────────────────────────────
groupRouter.put('/:id/messages/:messageId/reaction', async (req: any, res, next) => {
  try {
    const groupId = parseInt(req.params.id, 10);
    const messageId = parseInt(req.params.messageId, 10);
    const userId = req.user.userId as number;
    const { reaction } = req.body;
    if (isNaN(groupId) || isNaN(messageId)) return sendError(res, 'INVALID_INPUT', 'Invalid IDs', 400);
    if (!reaction || typeof reaction !== 'string' || reaction.trim().length === 0) {
      return sendError(res, 'INVALID_INPUT', 'Reaction emoji is required', 400);
    }
    const sanitized = reaction.trim().slice(0, 10);

    const repo = getGroupRepository();
    const isMember = await repo.isGroupMember(groupId, userId);
    if (!isMember) return sendError(res, 'FORBIDDEN', 'Not a group member', 403);

    const result = await repo.upsertGroupReaction(messageId, userId, sanitized);
    const members = await repo.getGroupMembers(groupId);

    for (const m of members) {
      const reactionsForMember = await repo.getGroupReactions(messageId, m.userId);
      realtimeServer.emitToUser(m.userId, 'group:message:reaction:updated', {
        groupId, messageId, reactions: reactionsForMember
      });
    }
    const reactions = await repo.getGroupReactions(messageId, userId);
    return sendSuccess(res, { success: true, reactionId: result.reactionId, reactions });
  } catch (err) {
    next(err);
  }
});

groupRouter.delete('/:id/messages/:messageId/reaction', async (req: any, res, next) => {
  try {
    const groupId = parseInt(req.params.id, 10);
    const messageId = parseInt(req.params.messageId, 10);
    const userId = req.user.userId as number;
    if (isNaN(groupId) || isNaN(messageId)) return sendError(res, 'INVALID_INPUT', 'Invalid IDs', 400);

    const repo = getGroupRepository();
    const isMember = await repo.isGroupMember(groupId, userId);
    if (!isMember) return sendError(res, 'FORBIDDEN', 'Not a group member', 403);

    await repo.removeGroupReaction(messageId, userId);
    const members = await repo.getGroupMembers(groupId);

    for (const m of members) {
      const reactionsForMember = await repo.getGroupReactions(messageId, m.userId);
      realtimeServer.emitToUser(m.userId, 'group:message:reaction:updated', {
        groupId, messageId, reactions: reactionsForMember
      });
    }
    const reactions = await repo.getGroupReactions(messageId, userId);
    return sendSuccess(res, { success: true, reactions });
  } catch (err) {
    next(err);
  }
});
