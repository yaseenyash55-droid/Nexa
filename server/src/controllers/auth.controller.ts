import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service.js';
import { sendSuccess } from '../utils/response.js';
import { AuthenticatedRequest } from '../types/index.js';
import { env } from '../config/env.js';

const authService = new AuthService();

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body);
      
      res.cookie('nexa_refresh_token', result.refreshToken, {
        httpOnly: true,
        secure: env.COOKIE_SECURE,
        sameSite: 'lax',
        maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
      });

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
      const result = await authService.login(req.body);

      res.cookie('nexa_refresh_token', result.refreshToken, {
        httpOnly: true,
        secure: env.COOKIE_SECURE,
        sameSite: 'lax',
        maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
      });

      return sendSuccess(res, {
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken
      }, 'Login successful');
    } catch (err) {
      next(err);
    }
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

      res.cookie('nexa_refresh_token', result.newRefreshToken, {
        httpOnly: true,
        secure: env.COOKIE_SECURE,
        sameSite: 'lax',
        maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
      });

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
      await authService.logout(refreshToken);
      res.clearCookie('nexa_refresh_token');
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
}
