import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { getSecurityRepository } from '../repositories/factory.js';
import { getUserRepository } from '../repositories/factory.js';
import { comparePassword } from '../utils/hash.js';
import { sendSuccess } from '../utils/response.js';
import { AuthenticatedRequest } from '../types/index.js';

export const securityRouter = Router();

securityRouter.get('/status', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user!.userId;
    const repo = getSecurityRepository();
    const settings = await repo.getSecuritySettings(userId);

    sendSuccess(res, {
      emailVerified: !!settings?.emailVerifiedAt,
      mfaEnabled: !!settings?.mfaEnabled,
      lastProtectionCheckAt: settings?.lastProtectionCheckAt || new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

securityRouter.post('/reauthenticate', requireAuth, async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password) {
      throw { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Password is required' };
    }
    const credential = await getUserRepository().findCredentialById((req as AuthenticatedRequest).user!.userId);
    if (!credential || !(await comparePassword(password, credential.passwordHash))) {
      throw { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'Current password is incorrect' };
    }
    sendSuccess(res, { reauthenticated: true, expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() });
  } catch (err) {
    next(err);
  }
});

securityRouter.post('/mfa/setup', requireAuth, async (req, res, next) => {
  try {
    throw { statusCode: 503, code: 'MFA_NOT_CONFIGURED', message: 'MFA is unavailable until a verified TOTP provider and encryption key are configured' };
  } catch (err) {
    next(err);
  }
});

securityRouter.post('/mfa/confirm', requireAuth, async (req, res, next) => {
  try {
    throw { statusCode: 503, code: 'MFA_NOT_CONFIGURED', message: 'MFA confirmation is unavailable until server-side TOTP verification is configured' };
  } catch (err) {
    next(err);
  }
});

securityRouter.delete('/mfa', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const repo = getSecurityRepository();
    await repo.updateSecuritySettings(authReq.user!.userId, { mfaEnabled: false });
    sendSuccess(res, { mfaEnabled: false, message: '2FA disabled successfully' });
  } catch (err) {
    next(err);
  }
});

securityRouter.get('/sessions', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const repo = getSecurityRepository();
    const sessions = await repo.getUserSessions(authReq.user!.userId);
    sendSuccess(res, sessions);
  } catch (err) {
    next(err);
  }
});

securityRouter.delete('/sessions/:sessionId', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { sessionId } = req.params;
    const repo = getSecurityRepository();
    const success = await repo.revokeSession(sessionId, authReq.user!.userId);
    sendSuccess(res, { revoked: success });
  } catch (err) {
    next(err);
  }
});

securityRouter.delete('/sessions/others', requireAuth, async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const repo = getSecurityRepository();
    await repo.revokeOtherSessions(authReq.user!.userId, 'current-session');
    sendSuccess(res, { revokedOthers: true });
  } catch (err) {
    next(err);
  }
});
