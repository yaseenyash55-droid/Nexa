import { Response, NextFunction } from 'express';
import { getNotificationRepository, getFcmTokenRepository } from '../repositories/factory.js';
import { AuthenticatedRequest } from '../types/index.js';
import { sendSuccess, sendError } from '../utils/response.js';

export class NotificationController {
  private get notifRepo() {
    return getNotificationRepository();
  }

  private get fcmRepo() {
    return getFcmTokenRepository();
  }

  async getNotifications(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return sendError(res, 'UNAUTHORIZED', 'Auth required', 401);
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
      if (!req.user) return sendError(res, 'UNAUTHORIZED', 'Auth required', 401);
      const unreadCount = await this.notifRepo.getUnreadCount(req.user.userId);
      return sendSuccess(res, { unreadCount });
    } catch (err) {
      next(err);
    }
  }

  async markAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return sendError(res, 'UNAUTHORIZED', 'Auth required', 401);
      const notifId = Number(req.params.id);
      if (isNaN(notifId)) {
        return sendError(res, 'VALIDATION_ERROR', 'Invalid notification ID', 400);
      }
      const updated = await this.notifRepo.markAsRead(notifId, req.user.userId);
      if (!updated) {
        return sendError(res, 'NOTIFICATION_NOT_FOUND', 'Notification not found', 404);
      }
      return sendSuccess(res, null, 'Notification marked as read');
    } catch (err) {
      next(err);
    }
  }

  async markAllAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return sendError(res, 'UNAUTHORIZED', 'Auth required', 401);
      await this.notifRepo.markAllAsRead(req.user.userId);
      return sendSuccess(res, null, 'All notifications marked as read');
    } catch (err) {
      next(err);
    }
  }

  async registerFcmToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return sendError(res, 'UNAUTHORIZED', 'Auth required', 401);
      const token = req.body?.fcmToken || req.body?.token;
      const platform = req.body?.platform || 'android';
      const deviceId = req.body?.deviceId;

      if (!token || typeof token !== 'string' || !token.trim() || token.length > 512) {
        return sendError(res, 'VALIDATION_ERROR', 'A valid FCM token string (1-512 characters) is required', 400);
      }

      const validPlatforms = ['android', 'ios', 'web'];
      if (!validPlatforms.includes(platform.toLowerCase())) {
        return sendError(res, 'VALIDATION_ERROR', 'Platform must be one of android, ios, or web', 400);
      }

      await this.fcmRepo.upsertToken(req.user.userId, token.trim(), platform.toLowerCase(), deviceId);
      return sendSuccess(res, { success: true }, 'FCM token registered successfully');
    } catch (err) {
      next(err);
    }
  }

  async revokeFcmToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return sendError(res, 'UNAUTHORIZED', 'Auth required', 401);
      const token = req.body?.fcmToken || req.body?.token;

      if (token && typeof token === 'string' && token.trim()) {
        const revoked = await this.fcmRepo.revokeToken(token.trim(), req.user.userId);
        return sendSuccess(res, { success: revoked }, revoked ? 'FCM token revoked' : 'FCM token not found');
      } else {
        const count = await this.fcmRepo.revokeUserTokens(req.user.userId);
        return sendSuccess(res, { success: true, count }, 'All user FCM tokens revoked');
      }
    } catch (err) {
      next(err);
    }
  }
}
