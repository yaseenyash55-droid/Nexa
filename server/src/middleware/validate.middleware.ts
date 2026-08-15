import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { sendError } from '../utils/response.js';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      return sendError(res, 'VALIDATION_ERROR', 'Invalid request body parameter(s)', 400, details);
    }
    req.body = result.data;
    next();
  };
}
