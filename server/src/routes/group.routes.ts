import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  createGroup,
  getUserGroups,
  getGroupMessages,
  sendGroupMessage,
  addGroupMembers
} from '../controllers/group.controller.js';

export const groupRouter = Router();

groupRouter.use(requireAuth);

groupRouter.post('/', createGroup);
groupRouter.get('/', getUserGroups);
groupRouter.get('/:id/messages', getGroupMessages);
groupRouter.post('/:id/messages', sendGroupMessage);
groupRouter.post('/:id/members', addGroupMembers);
