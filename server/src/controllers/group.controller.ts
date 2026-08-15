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

    const repo = getGroupRepository();
    const group = await repo.createGroup({
      name,
      description,
      avatarUrl,
      createdBy: currentUserId,
      memberIds
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
    const members = await repo.getGroupMembers(groupId);
    const isMember = members.some((m) => m.userId === currentUserId);
    if (!isMember) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You are not a member of this group' } });
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
    const { memberIds } = req.body;

    if (isNaN(groupId) || !Array.isArray(memberIds)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid group ID or member list' } });
    }

    const repo = getGroupRepository();
    const members = await repo.getGroupMembers(groupId);
    const isMember = members.some((m) => m.userId === currentUserId);
    if (!isMember) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You are not a member of this group' } });
    }

    for (const mId of memberIds) {
      await repo.addGroupMember(groupId, mId, 'MEMBER');
    }

    const updatedMembers = await repo.getGroupMembers(groupId);
    return res.json({ data: updatedMembers });
  } catch (error: any) {
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to add group members' } });
  }
}
