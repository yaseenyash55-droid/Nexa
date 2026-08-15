import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { sendSuccess } from '../utils/response.js';
import { AuthenticatedRequest } from '../types/index.js';

export const privacyRouter = Router();

const userPrivacyStore = new Map<number, any>();
const userHiddenWordsStore = new Map<number, string[]>();
const pendingFollowRequests = new Map<number, Array<{ id: number; username: string; displayName: string; time: string }>>();
const userBlockedStore = new Map<number, Set<number>>();
const submittedReports: Array<any> = [];

privacyRouter.get('/settings', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user!.userId;

    if (!userPrivacyStore.has(userId)) {
      userPrivacyStore.set(userId, {
        isPrivate: false,
        whoCanMessage: 'EVERYONE',
        whoCanComment: 'EVERYONE',
        activityStatusVisible: true,
        readReceiptsEnabled: true,
        hideLikeCounts: false
      });
    }

    sendSuccess(res, userPrivacyStore.get(userId));
  } catch (err) {
    next(err);
  }
});

privacyRouter.put('/settings', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user!.userId;
    const current = userPrivacyStore.get(userId) || {};
    const updated = { ...current, ...req.body };

    userPrivacyStore.set(userId, updated);
    sendSuccess(res, updated);
  } catch (err) {
    next(err);
  }
});

privacyRouter.get('/follow-requests', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const requests = pendingFollowRequests.get(authReq.user!.userId) || [];
    sendSuccess(res, requests);
  } catch (err) {
    next(err);
  }
});

privacyRouter.post('/follow-requests/:id/approve', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const reqId = parseInt(req.params.id, 10);
    const requests = pendingFollowRequests.get(authReq.user!.userId) || [];

    pendingFollowRequests.set(
      authReq.user!.userId,
      requests.filter(r => r.id !== reqId)
    );

    sendSuccess(res, { approved: true });
  } catch (err) {
    next(err);
  }
});

privacyRouter.post('/users/:id/block', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const targetUserId = parseInt(req.params.id, 10);
    
    if (!userBlockedStore.has(authReq.user!.userId)) {
      userBlockedStore.set(authReq.user!.userId, new Set());
    }
    userBlockedStore.get(authReq.user!.userId)!.add(targetUserId);

    sendSuccess(res, { blocked: true, targetUserId });
  } catch (err) {
    next(err);
  }
});

privacyRouter.delete('/users/:id/block', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const targetUserId = parseInt(req.params.id, 10);
    
    if (userBlockedStore.has(authReq.user!.userId)) {
      userBlockedStore.get(authReq.user!.userId)!.delete(targetUserId);
    }

    sendSuccess(res, { unblocked: true, targetUserId });
  } catch (err) {
    next(err);
  }
});

privacyRouter.get('/hidden-words', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const words = userHiddenWordsStore.get(authReq.user!.userId) || ['crypto_spam', 'buy_followers', 'scam_link'];
    sendSuccess(res, words);
  } catch (err) {
    next(err);
  }
});

privacyRouter.put('/hidden-words', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { words } = req.body;
    if (!Array.isArray(words)) {
      throw { statusCode: 400, code: 'VALIDATION_ERROR', message: 'words must be an array of strings' };
    }
    userHiddenWordsStore.set(authReq.user!.userId, words);
    sendSuccess(res, words);
  } catch (err) {
    next(err);
  }
});

privacyRouter.post('/reports', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { targetType, targetId, reason, details } = req.body;

    if (!targetType || !targetId || !reason) {
      throw { statusCode: 400, code: 'VALIDATION_ERROR', message: 'targetType, targetId, and reason are required' };
    }

    const report = {
      reportId: submittedReports.length + 1,
      reporterUserId: authReq.user!.userId,
      targetType,
      targetId,
      reason,
      details: details || '',
      createdAt: new Date().toISOString()
    };

    submittedReports.push(report);
    sendSuccess(res, { submitted: true, reportId: report.reportId }, 'Report received', undefined, 201);
  } catch (err) {
    next(err);
  }
});
