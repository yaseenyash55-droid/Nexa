import { Response, NextFunction } from 'express';
import { getNotificationRepository } from '../repositories/factory.js';
import { AuthenticatedRequest } from '../types/index.js';
import { sendSuccess } from '../utils/response.js';

export class NotificationController {
  private get notifRepo() {
    return getNotificationRepository();
  }

  async getNotifications(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Auth required', details: [] } });
      const cursor = req.query.cursor ? Number(req.query.cursor) : undefined;
      const limit = Number(req.query.limit) || 20;
      const result = await this.notifRepo.getUserNotifications(req.user.userId, cursor, limit);
      return sendSuccess(res, result.data, undefined, { nextCursor: result.nextCursor, hasMore: result.hasMore });
    } catch (err) {
      next(err);
    }
  }

  async getUnreadCount(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Auth required', details: [] } });
      const unreadCount = await this.notifRepo.getUnreadCount(req.user.userId);
      return sendSuccess(res, { unreadCount });
    } catch (err) {
      next(err);
    }
  }

  async markAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Auth required', details: [] } });
      const notifId = Number(req.params.id);
      if (isNaN(notifId)) {
        return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid notification ID', details: [] } });
      }
      const updated = await this.notifRepo.markAsRead(notifId, req.user.userId);
      if (!updated) {
        return res.status(404).json({ error: { code: 'NOTIFICATION_NOT_FOUND', message: 'Notification not found', details: [] } });
      }
      return sendSuccess(res, null, 'Notification marked as read');
    } catch (err) {
      next(err);
    }
  }

  async markAllAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Auth required', details: [] } });
      await this.notifRepo.markAllAsRead(req.user.userId);
      return sendSuccess(res, null, 'All notifications marked as read');
    } catch (err) {
      next(err);
    }
  }
}
