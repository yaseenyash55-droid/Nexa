import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.js';

export function validatePrivacySettings(req: Request, res: Response, next: NextFunction): void {
  const { isPrivate, whoCanMessage, whoCanComment, activityStatusVisible, readReceiptsEnabled, hideLikeCounts } = req.body;

  if (isPrivate !== undefined && typeof isPrivate !== 'boolean') {
    sendError(res, 'VALIDATION_ERROR', 'isPrivate must be a boolean', 400);
    return;
  }

  const validAudiences = ['EVERYONE', 'FOLLOWING', 'NOBODY'];
  if (whoCanMessage !== undefined && !validAudiences.includes(whoCanMessage)) {
    sendError(res, 'VALIDATION_ERROR', `whoCanMessage must be one of: ${validAudiences.join(', ')}`, 400);
    return;
  }

  if (whoCanComment !== undefined && !validAudiences.includes(whoCanComment)) {
    sendError(res, 'VALIDATION_ERROR', `whoCanComment must be one of: ${validAudiences.join(', ')}`, 400);
    return;
  }

  if (activityStatusVisible !== undefined && typeof activityStatusVisible !== 'boolean') {
    sendError(res, 'VALIDATION_ERROR', 'activityStatusVisible must be a boolean', 400);
    return;
  }

  if (readReceiptsEnabled !== undefined && typeof readReceiptsEnabled !== 'boolean') {
    sendError(res, 'VALIDATION_ERROR', 'readReceiptsEnabled must be a boolean', 400);
    return;
  }

  if (hideLikeCounts !== undefined && typeof hideLikeCounts !== 'boolean') {
    sendError(res, 'VALIDATION_ERROR', 'hideLikeCounts must be a boolean', 400);
    return;
  }

  next();
}

export function validateHiddenWordsInput(req: Request, res: Response, next: NextFunction): void {
  const { words } = req.body;
  if (!Array.isArray(words)) {
    sendError(res, 'VALIDATION_ERROR', 'words must be an array of strings', 400);
    return;
  }
  next();
}

export function validateTargetIdParam(req: Request, res: Response, next: NextFunction): void {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) {
    sendError(res, 'VALIDATION_ERROR', 'Invalid target ID parameter', 400);
    return;
  }
  next();
}

export function validateReportInput(req: Request, res: Response, next: NextFunction): void {
  const { targetType, targetId, reason, details } = req.body;
  const validTargetTypes = ['USER', 'POST', 'COMMENT', 'STORY', 'REEL', 'MESSAGE'];

  if (!targetType || !validTargetTypes.includes(String(targetType).toUpperCase())) {
    sendError(res, 'VALIDATION_ERROR', `targetType is required and must be one of: ${validTargetTypes.join(', ')}`, 400);
    return;
  }

  const parsedId = Number(targetId);
  if (!targetId || isNaN(parsedId) || parsedId <= 0) {
    sendError(res, 'VALIDATION_ERROR', 'targetId is required and must be a positive number', 400);
    return;
  }

  if (!reason || typeof reason !== 'string' || reason.trim().length < 2) {
    sendError(res, 'VALIDATION_ERROR', 'reason is required and must be at least 2 characters', 400);
    return;
  }

  if (details && (typeof details !== 'string' || details.length > 1000)) {
    sendError(res, 'VALIDATION_ERROR', 'details cannot exceed 1000 characters', 400);
    return;
  }

  next();
}
