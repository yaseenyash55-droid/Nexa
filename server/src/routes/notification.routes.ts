import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();
const controller = new NotificationController();

router.get('/', requireAuth, (req, res, next) => controller.getNotifications(req, res, next));
router.get('/unread-count', requireAuth, (req, res, next) => controller.getUnreadCount(req, res, next));
router.post('/read-all', requireAuth, (req, res, next) => controller.markAllAsRead(req, res, next));
router.patch('/read-all', requireAuth, (req, res, next) => controller.markAllAsRead(req, res, next));
router.patch('/:id/read', requireAuth, (req, res, next) => controller.markAsRead(req, res, next));

export default router;
