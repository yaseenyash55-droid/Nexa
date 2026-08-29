import { Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { getGroupRepository } from '../repositories/factory.js';
import { realtimeServer } from '../socket.js';
import { aiMentionAssistantService } from '../ai/messaging/mention.service.js';
import { sendError } from '../utils/response.js';

export async function createGroup(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    const { name, description, avatarUrl, memberIds } = req.body;
    if (!name || !name.trim()) {
      return sendError(res, 'VALIDATION_ERROR', 'Group name is required', 400);
    }

    const parsedMemberIds: number[] = Array.isArray(memberIds)
      ? Array.from(
          new Set(
            memberIds
              .map((id: any) => parseInt(id, 10))
              .filter((id: number) => !isNaN(id) && id > 0 && id !== currentUserId)
          )
        )
      : [];

    const repo = getGroupRepository();
    const group = await repo.createGroup({
      name: name.trim(),
      description: description?.trim() || undefined,
      avatarUrl: avatarUrl?.trim() || undefined,
      createdBy: currentUserId,
      memberIds: parsedMemberIds
    });

    return res.status(201).json({ data: group });
  } catch (error: any) {
    return sendError(res, 'INTERNAL_ERROR', error.message || 'Failed to create group', 500);
  }
}

export async function getUserGroups(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    const repo = getGroupRepository();
    const groups = await repo.getUserGroups(currentUserId);
    return res.json({ data: groups });
  } catch (error: any) {
    return sendError(res, 'INTERNAL_ERROR', error.message || 'Failed to fetch groups', 500);
  }
}

export async function getGroupMessages(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    const groupId = parseInt(req.params.id, 10);
    if (isNaN(groupId)) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid group ID', 400);
    }

    const repo = getGroupRepository();
    const members = await repo.getGroupMembers(groupId);
    const isMember = members.some((m) => m.userId === currentUserId);
    if (!isMember) {
      return sendError(res, 'FORBIDDEN', 'You are not a member of this group', 403);
    }

    const messages = await repo.getGroupMessages(groupId);
    return res.json({ data: messages });
  } catch (error: any) {
    return sendError(res, 'INTERNAL_ERROR', error.message || 'Failed to fetch group messages', 500);
  }
}

export async function sendGroupMessage(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    const groupId = parseInt(req.params.id, 10);
    const { content, attachments, replyToMessageId } = req.body;

    if (isNaN(groupId) || (!content?.trim() && (!attachments || attachments.length === 0))) {
      return sendError(res, 'VALIDATION_ERROR', 'Group ID and message content or attachments are required', 400);
    }

    const repo = getGroupRepository();
    const group = await repo.getGroupById(groupId);
    if (!group) {
      return sendError(res, 'GROUP_NOT_FOUND', 'Group not found', 404);
    }

    const members = await repo.getGroupMembers(groupId);
    const currentMember = members.find((m) => m.userId === currentUserId);
    if (!currentMember) {
      return sendError(res, 'FORBIDDEN', 'You are not a member of this group', 403);
    }

    // Check announcement mode / admin-only posting
    if (group.onlyAdminsCanPost && currentMember.role !== 'ADMIN') {
      return sendError(res, 'FORBIDDEN', 'Only admins can post in this group', 403);
    }

    if (attachments && Array.isArray(attachments)) {
      const mediaIds = attachments.map(a => a.mediaId).filter(Boolean);
      if (mediaIds.length > 0) {
        const { verifyMediaOwnership } = await import('../services/media.service.js');
        const isOwner = await verifyMediaOwnership(currentUserId, mediaIds);
        if (!isOwner) {
          return sendError(res, 'FORBIDDEN', 'You do not have permission to attach this media', 403);
        }
      }
    }

    const msg = await repo.sendGroupMessage(groupId, currentUserId, content ? content.trim() : '', Array.isArray(attachments) ? attachments : undefined, replyToMessageId ? Number(replyToMessageId) : null);
    
    // Broadcast via Socket.IO to group members
    for (const member of members) {
      if (member.userId !== currentUserId) {
        realtimeServer.emitToUser(member.userId, 'group:message:created', msg);
      }
    }

    // Asynchronously check for @nexa mention in group chat
    if (aiMentionAssistantService.isNexaMention(content)) {
      aiMentionAssistantService
        .handleMention({
          senderId: currentUserId,
          content: content.trim(),
          groupId,
          messageId: msg.messageId
        })
        .catch(() => {
          // safe swallow
        });
    }

    return res.status(201).json({ data: msg });
  } catch (error: any) {
    return sendError(res, 'INTERNAL_ERROR', error.message || 'Failed to send group message', 500);
  }
}

export async function addGroupMembers(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    const groupId = parseInt(req.params.id, 10);
    const memberIds = req.body.memberIds || req.body.members;

    if (isNaN(groupId) || !Array.isArray(memberIds)) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid group ID or member list', 400);
    }

    const repo = getGroupRepository();
    const members = await repo.getGroupMembers(groupId);
    const isMember = members.some((m) => m.userId === currentUserId);
    if (!isMember) {
      return sendError(res, 'FORBIDDEN', 'You are not a member of this group', 403);
    }

    const existingUserIds = new Set(members.map((m) => m.userId));
    const newMemberIds = memberIds.map(Number).filter((id) => !isNaN(id) && id > 0 && !existingUserIds.has(id));

    for (const mId of newMemberIds) {
      await repo.addGroupMember(groupId, mId, 'MEMBER');
      realtimeServer.emitToUser(mId, 'group:joined', { groupId });
    }

    const updatedMembers = await repo.getGroupMembers(groupId);
    for (const member of updatedMembers) {
      realtimeServer.emitToUser(member.userId, 'group:members:updated', { groupId, members: updatedMembers });
    }

    return res.json({ data: updatedMembers });
  } catch (error: any) {
    return sendError(res, 'INTERNAL_ERROR', error.message || 'Failed to add group members', 500);
  }
}

export async function removeGroupMember(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    const groupId = parseInt(req.params.id, 10);
    const targetUserId = parseInt(req.params.userId, 10);

    if (isNaN(groupId) || isNaN(targetUserId)) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid group or user ID', 400);
    }

    const repo = getGroupRepository();
    const members = await repo.getGroupMembers(groupId);
    const currentMember = members.find((m) => m.userId === currentUserId);
    if (!currentMember) {
      return sendError(res, 'FORBIDDEN', 'You are not a member of this group', 403);
    }

    const isSelf = targetUserId === currentUserId;
    if (!isSelf && currentMember.role !== 'ADMIN') {
      return sendError(res, 'FORBIDDEN', 'Only admins can remove other members', 403);
    }

    await repo.removeGroupMember(groupId, targetUserId);

    // If leaving user was sole admin, promote next member
    if (isSelf && currentMember.role === 'ADMIN') {
      const remaining = members.filter((m) => m.userId !== currentUserId);
      if (remaining.length > 0 && !remaining.some((m) => m.role === 'ADMIN')) {
        await repo.addGroupMember(groupId, remaining[0].userId, 'ADMIN');
      }
    }

    const updatedMembers = await repo.getGroupMembers(groupId);
    realtimeServer.emitToUser(targetUserId, 'group:removed', { groupId });
    for (const m of updatedMembers) {
      realtimeServer.emitToUser(m.userId, 'group:members:updated', { groupId, members: updatedMembers });
    }

    return res.json({ data: { success: true, isSelf, removedUserId: targetUserId } });
  } catch (error: any) {
    return sendError(res, 'INTERNAL_ERROR', error.message || 'Failed to remove group member', 500);
  }
}

export async function leaveGroup(req: AuthenticatedRequest, res: Response) {
  req.params.userId = String(req.user?.userId);
  return removeGroupMember(req, res);
}

export async function updateGroupSettings(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    const groupId = parseInt(req.params.id, 10);
    const { onlyAdminsCanPost, name, description } = req.body;

    if (isNaN(groupId)) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid group ID', 400);
    }

    const repo = getGroupRepository();
    const members = await repo.getGroupMembers(groupId);
    const currentMember = members.find((m) => m.userId === currentUserId);
    if (!currentMember || currentMember.role !== 'ADMIN') {
      return sendError(res, 'FORBIDDEN', 'Only group admins can update settings', 403);
    }

    await repo.updateGroupSettings(groupId, { onlyAdminsCanPost, name, description });
    const updatedGroup = await repo.getGroupById(groupId);

    for (const m of members) {
      realtimeServer.emitToUser(m.userId, 'group:settings:updated', updatedGroup);
    }

    return res.json({ data: updatedGroup });
  } catch (error: any) {
    return sendError(res, 'INTERNAL_ERROR', error.message || 'Failed to update group settings', 500);
  }
}

export async function deleteGroup(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    const groupId = parseInt(req.params.id, 10);
    if (isNaN(groupId)) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid group ID', 400);
    }

    const repo = getGroupRepository();
    const group = await repo.getGroupById(groupId);
    if (!group) {
      return sendError(res, 'GROUP_NOT_FOUND', 'Group not found', 404);
    }

    const members = await repo.getGroupMembers(groupId);
    const currentMember = members.find((m) => m.userId === currentUserId);
    const isCreator = group.createdBy === currentUserId;
    const isAdmin = currentMember?.role === 'ADMIN';

    if (!isCreator && !isAdmin) {
      return sendError(res, 'FORBIDDEN', 'Only the group creator or admins can delete this group', 403);
    }

    await repo.deleteGroup(groupId);

    for (const m of members) {
      realtimeServer.emitToUser(m.userId, 'group:deleted', { groupId });
    }

    return res.json({ data: { success: true, deletedGroupId: groupId } });
  } catch (error: any) {
    return sendError(res, 'INTERNAL_ERROR', error.message || 'Failed to delete group', 500);
  }
}

export async function getGroupById(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    const groupId = parseInt(req.params.id, 10);
    if (isNaN(groupId)) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid group ID', 400);
    }

    const repo = getGroupRepository();
    const group = await repo.getGroupById(groupId);
    if (!group) {
      return sendError(res, 'GROUP_NOT_FOUND', 'Group not found', 404);
    }

    const members = await repo.getGroupMembers(groupId);
    const isMember = members.some((m) => m.userId === currentUserId);
    if (!isMember) {
      return sendError(res, 'FORBIDDEN', 'You are not a member of this group', 403);
    }

    return res.json({ data: group });
  } catch (error: any) {
    return sendError(res, 'INTERNAL_ERROR', error.message || 'Failed to fetch group', 500);
  }
}

export async function getGroupMembers(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return sendError(res, 'UNAUTHORIZED', 'Authentication required', 401);
    }

    const groupId = parseInt(req.params.id, 10);
    if (isNaN(groupId)) {
      return sendError(res, 'VALIDATION_ERROR', 'Invalid group ID', 400);
    }

    const repo = getGroupRepository();
    const members = await repo.getGroupMembers(groupId);
    const isMember = members.some((m) => m.userId === currentUserId);
    if (!isMember) {
      return sendError(res, 'FORBIDDEN', 'You are not a member of this group', 403);
    }

    return res.json({ data: members });
  } catch (error: any) {
    return sendError(res, 'INTERNAL_ERROR', error.message || 'Failed to fetch group members', 500);
  }
}
