import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { privacyService } from '../services/privacy.service.js';
import { sendSuccess } from '../utils/response.js';

export class PrivacyController {
  async getSettings(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const settings = await privacyService.getSettings(userId);
      sendSuccess(res, settings);
    } catch (err) {
      next(err);
    }
  }

  async updateSettings(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const settings = await privacyService.updateSettings(userId, req.body);
      sendSuccess(res, settings);
    } catch (err) {
      next(err);
    }
  }

  async getHiddenWords(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const words = await privacyService.getHiddenWords(userId);
      sendSuccess(res, words);
    } catch (err) {
      next(err);
    }
  }

  async updateHiddenWords(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const words = await privacyService.setHiddenWords(userId, req.body.words);
      sendSuccess(res, words);
    } catch (err) {
      next(err);
    }
  }

  async getBlockedUsers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const blockedList = await privacyService.getBlockedUsers(userId);
      sendSuccess(res, blockedList);
    } catch (err) {
      next(err);
    }
  }

  async blockUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const blockerId = req.user!.userId;
      const targetUserId = parseInt(req.params.id, 10);
      await privacyService.blockUser(blockerId, targetUserId);
      sendSuccess(res, { blocked: true, targetUserId });
    } catch (err) {
      next(err);
    }
  }

  async unblockUser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const blockerId = req.user!.userId;
      const targetUserId = parseInt(req.params.id, 10);
      await privacyService.unblockUser(blockerId, targetUserId);
      sendSuccess(res, { unblocked: true, targetUserId });
    } catch (err) {
      next(err);
    }
  }

  async getFollowRequests(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const requests = await privacyService.getFollowRequests(userId);
      sendSuccess(res, requests);
    } catch (err) {
      next(err);
    }
  }

  async createFollowRequest(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const requesterId = req.user!.userId;
      const targetUserId = parseInt(req.params.id, 10);
      const result = await privacyService.createFollowRequest(requesterId, targetUserId);
      sendSuccess(res, result, 'Follow request created', undefined, 201);
    } catch (err) {
      next(err);
    }
  }

  async approveFollowRequest(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const targetUserId = req.user!.userId;
      const requestId = parseInt(req.params.id, 10);
      await privacyService.approveFollowRequest(targetUserId, requestId);
      sendSuccess(res, { approved: true, requestId });
    } catch (err) {
      next(err);
    }
  }

  async rejectFollowRequest(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const targetUserId = req.user!.userId;
      const requestId = parseInt(req.params.id, 10);
      await privacyService.rejectFollowRequest(targetUserId, requestId);
      sendSuccess(res, { rejected: true, requestId });
    } catch (err) {
      next(err);
    }
  }

  async createReport(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const reporterUserId = req.user!.userId;
      const { targetType, targetId, reason, details } = req.body;
      const result = await privacyService.createReport(reporterUserId, {
        targetType,
        targetId: Number(targetId),
        reason,
        details
      });
      sendSuccess(res, { submitted: true, reportId: result.reportId }, 'Report received', undefined, 201);
    } catch (err) {
      next(err);
    }
  }

  async getReports(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const role = req.user?.role;
      const { status, targetType } = req.query;
      const reports = await privacyService.getReports(role, {
        status: status ? String(status) : undefined,
        targetType: targetType ? String(targetType) : undefined
      });
      sendSuccess(res, reports);
    } catch (err) {
      next(err);
    }
  }

  async createModerationAction(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const moderatorUserId = req.user!.userId;
      const role = req.user?.role;
      const { reportId, actionType, targetType, targetId, notes } = req.body;
      const result = await privacyService.createModerationAction(moderatorUserId, role, {
        reportId: reportId ? Number(reportId) : undefined,
        actionType,
        targetType,
        targetId: Number(targetId),
        notes
      });
      sendSuccess(res, { success: true, actionId: result.actionId }, 'Moderation action applied', undefined, 201);
    } catch (err) {
      next(err);
    }
  }
}

export const privacyController = new PrivacyController();
