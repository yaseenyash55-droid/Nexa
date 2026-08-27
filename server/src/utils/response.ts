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
  // RFC 7807 Problem Details for HTTP APIs (Audit Item 7)
  res.setHeader('Content-Type', 'application/problem+json');
  return res.status(statusCode).json({
    type: `https://nexa-social-app.surge.sh/docs/errors/${code.toLowerCase().replace(/_/g, '-')}`,
    title: code,
    status: statusCode,
    detail: message,
    ...(details.length > 0 ? { extensions: { details } } : {})
  });
}
