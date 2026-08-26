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
