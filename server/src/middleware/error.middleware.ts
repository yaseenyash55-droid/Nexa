import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { sendError } from '../utils/response.js';

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const requestId = (req.headers['x-request-id'] as string) || Math.random().toString(36).substring(7);

  logger.error({ requestId, err, path: req.path, method: req.method }, 'Unhandled API Exception');

  // Explicit thrown application error
  if (err.statusCode && err.code && err.message) {
    return sendError(res, err.code, err.message, err.statusCode, err.details || []);
  }

  // Handle Oracle-specific error codes
  if (err.code && typeof err.code === 'string' && err.code.startsWith('ORA-')) {
    const oraCode = err.code;
    if (oraCode.includes('ORA-00001')) {
      return sendError(res, 'DUPLICATE_ENTRY', 'A record with this key already exists', 409);
    }
    if (oraCode.includes('ORA-02291')) {
      return sendError(res, 'REFERENCED_KEY_NOT_FOUND', 'Referenced user or resource does not exist', 400);
    }
    if (oraCode.includes('ORA-02292')) {
      return sendError(res, 'CHILD_RECORD_EXISTS', 'Cannot delete resource because related items exist', 400);
    }
    if (oraCode.includes('ORA-01400')) {
      return sendError(res, 'NULL_NOT_ALLOWED', 'Required field cannot be empty', 400);
    }
    if (oraCode.includes('ORA-28000') || oraCode.includes('ORA-01017')) {
      return sendError(res, 'DATABASE_UNAVAILABLE', 'Database service is currently updating credentials. Please try again shortly.', 503);
    }
  }

  // Generic sanitized internal error
  const safeMessage = process.env.NODE_ENV === 'production' 
    ? 'An unexpected error occurred. Please try again later.'
    : err.message || 'Internal Server Error';

  return sendError(res, 'INTERNAL_SERVER_ERROR', safeMessage, 500);
}
