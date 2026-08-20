import { Request, Response, NextFunction } from 'express';

export function validatePrivacySettings(req: Request, res: Response, next: NextFunction): void {
  const { isPrivate, whoCanMessage, whoCanComment, activityStatusVisible, readReceiptsEnabled, hideLikeCounts } = req.body;

  if (isPrivate !== undefined && typeof isPrivate !== 'boolean') {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'isPrivate must be a boolean' } });
    return;
  }

  const validAudiences = ['EVERYONE', 'FOLLOWING', 'NOBODY'];
  if (whoCanMessage !== undefined && !validAudiences.includes(whoCanMessage)) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `whoCanMessage must be one of: ${validAudiences.join(', ')}` } });
    return;
  }

  if (whoCanComment !== undefined && !validAudiences.includes(whoCanComment)) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: `whoCanComment must be one of: ${validAudiences.join(', ')}` } });
    return;
  }

  if (activityStatusVisible !== undefined && typeof activityStatusVisible !== 'boolean') {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'activityStatusVisible must be a boolean' } });
    return;
  }

  if (readReceiptsEnabled !== undefined && typeof readReceiptsEnabled !== 'boolean') {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'readReceiptsEnabled must be a boolean' } });
    return;
  }

  if (hideLikeCounts !== undefined && typeof hideLikeCounts !== 'boolean') {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'hideLikeCounts must be a boolean' } });
    return;
  }

  next();
}

export function validateHiddenWordsInput(req: Request, res: Response, next: NextFunction): void {
  const { words } = req.body;
  if (!Array.isArray(words)) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'words must be an array of strings' } });
    return;
  }
  next();
}

export function validateTargetIdParam(req: Request, res: Response, next: NextFunction): void {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id) || id <= 0) {
    res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid target ID parameter' } });
    return;
  }
  next();
}

export function validateReportInput(req: Request, res: Response, next: NextFunction): void {
  const { targetType, targetId, reason, details } = req.body;
  const validTargetTypes = ['USER', 'POST', 'COMMENT', 'STORY', 'REEL', 'MESSAGE'];

  if (!targetType || !validTargetTypes.includes(String(targetType).toUpperCase())) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: `targetType is required and must be one of: ${validTargetTypes.join(', ')}` }
    });
    return;
  }

  const parsedId = Number(targetId);
  if (!targetId || isNaN(parsedId) || parsedId <= 0) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'targetId is required and must be a positive number' }
    });
    return;
  }

  if (!reason || typeof reason !== 'string' || reason.trim().length < 2) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'reason is required and must be at least 2 characters' }
    });
    return;
  }

  if (details && (typeof details !== 'string' || details.length > 1000)) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'details cannot exceed 1000 characters' }
    });
    return;
  }

  next();
}
