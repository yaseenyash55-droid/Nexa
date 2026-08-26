import { Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { getGroupRepository } from '../repositories/factory.js';
import { realtimeServer } from '../socket.js';

export async function createGroup(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }

    const { name, description, avatarUrl, memberIds } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Group name is required' } });
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
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to create group' } });
  }
}

export async function getUserGroups(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }

    const repo = getGroupRepository();
    const groups = await repo.getUserGroups(currentUserId);
    return res.json({ data: groups });
  } catch (error: any) {
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to fetch groups' } });
  }
}

export async function getGroupMessages(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }

    const groupId = parseInt(req.params.id, 10);
    if (isNaN(groupId)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid group ID' } });
    }

    const repo = getGroupRepository();
    const members = await repo.getGroupMembers(groupId);
    const isMember = members.some((m) => m.userId === currentUserId);
    if (!isMember) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You are not a member of this group' } });
    }

    const messages = await repo.getGroupMessages(groupId);
    return res.json({ data: messages });
  } catch (error: any) {
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to fetch group messages' } });
  }
}

export async function sendGroupMessage(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }

    const groupId = parseInt(req.params.id, 10);
    const { content } = req.body;

    if (isNaN(groupId) || !content || !content.trim()) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Group ID and message content are required' } });
    }

    const repo = getGroupRepository();
    const group = await repo.getGroupById(groupId);
    if (!group) {
      return res.status(404).json({ error: { code: 'GROUP_NOT_FOUND', message: 'Group not found' } });
    }

    const members = await repo.getGroupMembers(groupId);
    const currentMember = members.find((m) => m.userId === currentUserId);
    if (!currentMember) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You are not a member of this group' } });
    }

    // Check announcement mode / admin-only posting
    if (group.onlyAdminsCanPost && currentMember.role !== 'ADMIN') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only admins can post in this group' } });
    }

    const msg = await repo.sendGroupMessage(groupId, currentUserId, content);
    
    // Broadcast via Socket.IO to group members
    for (const member of members) {
      if (member.userId !== currentUserId) {
        realtimeServer.emitToUser(member.userId, 'group:message:created', msg);
      }
    }

    return res.status(201).json({ data: msg });
  } catch (error: any) {
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to send group message' } });
  }
}

export async function addGroupMembers(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }

    const groupId = parseInt(req.params.id, 10);
    const memberIds = req.body.memberIds || req.body.members;

    if (isNaN(groupId) || !Array.isArray(memberIds)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid group ID or member list' } });
    }

    const repo = getGroupRepository();
    const members = await repo.getGroupMembers(groupId);
    const isMember = members.some((m) => m.userId === currentUserId);
    if (!isMember) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You are not a member of this group' } });
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
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to add group members' } });
  }
}

export async function removeGroupMember(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }

    const groupId = parseInt(req.params.id, 10);
    const targetUserId = parseInt(req.params.userId, 10);

    if (isNaN(groupId) || isNaN(targetUserId)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid group or user ID' } });
    }

    const repo = getGroupRepository();
    const members = await repo.getGroupMembers(groupId);
    const currentMember = members.find((m) => m.userId === currentUserId);
    if (!currentMember) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You are not a member of this group' } });
    }

    const isSelf = targetUserId === currentUserId;
    if (!isSelf && currentMember.role !== 'ADMIN') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only admins can remove other members' } });
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
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to remove group member' } });
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
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }

    const groupId = parseInt(req.params.id, 10);
    const { onlyAdminsCanPost, name, description } = req.body;

    if (isNaN(groupId)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid group ID' } });
    }

    const repo = getGroupRepository();
    const members = await repo.getGroupMembers(groupId);
    const currentMember = members.find((m) => m.userId === currentUserId);
    if (!currentMember || currentMember.role !== 'ADMIN') {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only group admins can update settings' } });
    }

    await repo.updateGroupSettings(groupId, { onlyAdminsCanPost, name, description });
    const updatedGroup = await repo.getGroupById(groupId);

    for (const m of members) {
      realtimeServer.emitToUser(m.userId, 'group:settings:updated', updatedGroup);
    }

    return res.json({ data: updatedGroup });
  } catch (error: any) {
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to update group settings' } });
  }
}

export async function deleteGroup(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }

    const groupId = parseInt(req.params.id, 10);
    if (isNaN(groupId)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid group ID' } });
    }

    const repo = getGroupRepository();
    const group = await repo.getGroupById(groupId);
    if (!group) {
      return res.status(404).json({ error: { code: 'GROUP_NOT_FOUND', message: 'Group not found' } });
    }

    const members = await repo.getGroupMembers(groupId);
    const currentMember = members.find((m) => m.userId === currentUserId);
    const isCreator = group.createdBy === currentUserId;
    const isAdmin = currentMember?.role === 'ADMIN';

    if (!isCreator && !isAdmin) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only the group creator or admins can delete this group' } });
    }

    await repo.deleteGroup(groupId);

    for (const m of members) {
      realtimeServer.emitToUser(m.userId, 'group:deleted', { groupId });
    }

    return res.json({ data: { success: true, deletedGroupId: groupId } });
  } catch (error: any) {
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to delete group' } });
  }
}

export async function getGroupById(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }

    const groupId = parseInt(req.params.id, 10);
    if (isNaN(groupId)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid group ID' } });
    }

    const repo = getGroupRepository();
    const group = await repo.getGroupById(groupId);
    if (!group) {
      return res.status(404).json({ error: { code: 'GROUP_NOT_FOUND', message: 'Group not found' } });
    }

    const members = await repo.getGroupMembers(groupId);
    const isMember = members.some((m) => m.userId === currentUserId);
    if (!isMember) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You are not a member of this group' } });
    }

    return res.json({ data: group });
  } catch (error: any) {
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to fetch group' } });
  }
}

export async function getGroupMembers(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user?.userId;
    if (!currentUserId) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }

    const groupId = parseInt(req.params.id, 10);
    if (isNaN(groupId)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid group ID' } });
    }

    const repo = getGroupRepository();
    const members = await repo.getGroupMembers(groupId);
    const isMember = members.some((m) => m.userId === currentUserId);
    if (!isMember) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You are not a member of this group' } });
    }

    return res.json({ data: members });
  } catch (error: any) {
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to fetch group members' } });
  }
}
