import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { privacyController } from '../controllers/privacy.controller.js';
import {
  validatePrivacySettings,
  validateHiddenWordsInput,
  validateTargetIdParam,
  validateReportInput
} from '../middleware/privacy.validation.js';

export const privacyRouter = Router();

// Privacy Settings
privacyRouter.get('/settings', requireAuth, (req, res, next) => privacyController.getSettings(req as any, res, next));
privacyRouter.put('/settings', requireAuth, validatePrivacySettings, (req, res, next) => privacyController.updateSettings(req as any, res, next));

// Hidden Words
privacyRouter.get('/hidden-words', requireAuth, (req, res, next) => privacyController.getHiddenWords(req as any, res, next));
privacyRouter.put('/hidden-words', requireAuth, validateHiddenWordsInput, (req, res, next) => privacyController.updateHiddenWords(req as any, res, next));

// User Blocks
privacyRouter.get('/blocked-users', requireAuth, (req, res, next) => privacyController.getBlockedUsers(req as any, res, next));
privacyRouter.post('/users/:id/block', requireAuth, validateTargetIdParam, (req, res, next) => privacyController.blockUser(req as any, res, next));
privacyRouter.delete('/users/:id/block', requireAuth, validateTargetIdParam, (req, res, next) => privacyController.unblockUser(req as any, res, next));

// Follow Requests
privacyRouter.get('/follow-requests', requireAuth, (req, res, next) => privacyController.getFollowRequests(req as any, res, next));
privacyRouter.post('/users/:id/follow-request', requireAuth, validateTargetIdParam, (req, res, next) => privacyController.createFollowRequest(req as any, res, next));
privacyRouter.post('/follow-requests/:id/approve', requireAuth, validateTargetIdParam, (req, res, next) => privacyController.approveFollowRequest(req as any, res, next));
privacyRouter.post('/follow-requests/:id/reject', requireAuth, validateTargetIdParam, (req, res, next) => privacyController.rejectFollowRequest(req as any, res, next));

// Reports & Moderation
privacyRouter.post('/reports', requireAuth, validateReportInput, (req, res, next) => privacyController.createReport(req as any, res, next));
privacyRouter.get('/reports', requireAuth, (req, res, next) => privacyController.getReports(req as any, res, next));
privacyRouter.post('/moderation/actions', requireAuth, (req, res, next) => privacyController.createModerationAction(req as any, res, next));
