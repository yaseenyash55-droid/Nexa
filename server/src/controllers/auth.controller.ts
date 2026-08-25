import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service.js';
import { sendSuccess } from '../utils/response.js';
import { AuthenticatedRequest } from '../types/index.js';
import { env } from '../config/env.js';

const authService = new AuthService();

export function getRefreshTokenCookieOptions() {
  const isProduction = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
  };
}

export function getClearRefreshTokenCookieOptions() {
  const isProduction = env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
    path: '/'
  };
}

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body);
      
      res.cookie('nexa_refresh_token', result.refreshToken, getRefreshTokenCookieOptions());

      return sendSuccess(res, {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      }, 'Registration successful', undefined, 201);
    } catch (err) {
      next(err);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login({
        ...req.body,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip
      });
      if (result.mfaRequired) return sendSuccess(res, result, 'Verification code sent');

      res.cookie('nexa_refresh_token', result.refreshToken, getRefreshTokenCookieOptions());

      return sendSuccess(res, {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      }, 'Login successful');
    } catch (err) {
      next(err);
    }
  }

  async verifyLoginOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.verifyLoginOtp(req.body.challengeId, req.body.code);
      res.cookie('nexa_refresh_token', result.refreshToken, getRefreshTokenCookieOptions());
      return sendSuccess(res, { user: result.user, accessToken: result.accessToken, refreshToken: result.refreshToken }, 'Login verification successful');
    } catch (err) { next(err); }
  }

  async refresh(req: Request, res: Response, next: NextFunction) {
    try {
      let refreshToken = req.cookies?.nexa_refresh_token || req.body?.refreshToken;
      if ((!refreshToken || refreshToken === 'undefined' || refreshToken === 'null') && req.headers.authorization?.startsWith('Bearer ')) {
        refreshToken = req.headers.authorization.substring(7);
      }

      if (!refreshToken || refreshToken === 'undefined' || refreshToken === 'null') {
        return res.status(401).json({
          error: {
            code: 'MISSING_REFRESH_TOKEN',
            message: 'Refresh token cookie or payload is missing',
            details: []
          }
        });
      }

      const result = await authService.refreshTokens(refreshToken);

      res.cookie('nexa_refresh_token', result.newRefreshToken, getRefreshTokenCookieOptions());

      return sendSuccess(res, {
        accessToken: result.accessToken,
        refreshToken: result.newRefreshToken
      }, 'Token refreshed');
    } catch (err) {
      next(err);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const refreshToken = req.cookies?.nexa_refresh_token || req.body?.refreshToken;
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
      res.clearCookie('nexa_refresh_token', getClearRefreshTokenCookieOptions());
      return sendSuccess(res, null, 'Logged out successfully');
    } catch (err) {
      next(err);
    }
  }

  async me(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: { code: 'UNAUTHORIZED', message: 'Not authenticated', details: [] }
        });
      }
      return sendSuccess(res, req.user);
    } catch (err) {
      next(err);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { email } = req.body;
      const result = await authService.requestPasswordReset(email);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction) {
    try {
      const { token, newPassword } = req.body;
      const result = await authService.resetPassword(token, newPassword);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async verifyEmail(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, code, token: bodyToken } = req.body;
      const token = bodyToken || (req.query.token as string);
      const result = email && code
        ? await authService.verifyEmailCode(email, code)
        : await authService.verifyEmailToken(token);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async resendVerification(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      const email = req.body.email || req.user?.email;
      if (!userId && !email) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Email address or authenticated session is required', details: [] }
        });
      }
      const result = await authService.sendEmailVerification(userId || 0, email);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
}
