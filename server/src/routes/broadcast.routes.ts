import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { createBroadcast, getUserBroadcasts } from '../controllers/broadcast.controller.js';

export const broadcastRouter = Router();

broadcastRouter.use(requireAuth);

broadcastRouter.post('/', createBroadcast);
broadcastRouter.get('/', getUserBroadcasts);
