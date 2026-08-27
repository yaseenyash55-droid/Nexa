import { Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { AuthenticatedRequest } from '../types/index.js';
import { sendError } from '../utils/response.js';

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    let token: string | undefined;

    // 1. Check Authorization Bearer Header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    // 2. Fallback to HttpOnly Cookie
    if (!token && req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return sendError(res, 'UNAUTHORIZED', 'Authentication token required', 401);
    }

    // 3. Verify JWT Access Token
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return sendError(res, 'UNAUTHORIZED', 'Invalid or expired access token', 401);
    }

    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      email: decoded.email
    };

    return next();
  } catch (err: any) {
    return sendError(res, 'INVALID_TOKEN', 'Invalid or expired access token', 401);
  }
}

export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  try {
    let token: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (token) {
      const decoded = verifyAccessToken(token);
      if (decoded) {
        req.user = {
          userId: decoded.userId,
          username: decoded.username,
          email: decoded.email
        };
      }
    }
  } catch {
    // Ignore invalid optional tokens
  }
  return next();
}
