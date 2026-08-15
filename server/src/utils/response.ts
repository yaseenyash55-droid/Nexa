import { Response } from 'express';

export function sendSuccess<T>(res: Response, data: T, message?: string, meta?: Record<string, unknown>, statusCode = 200) {
  return res.status(statusCode).json({
    data,
    ...(message ? { message } : {}),
    ...(meta ? { meta } : {})
  });
}

export function sendError(
  res: Response, 
  code: string, 
  message: string, 
  statusCode = 400, 
  details: unknown[] = []
) {
  return res.status(statusCode).json({
    error: {
      code,
      message,
      details
    }
  });
}
