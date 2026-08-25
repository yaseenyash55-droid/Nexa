import { z } from 'zod';

const storedImageUrlSchema = z.string().refine(
  value =>
    value === '' ||
    /^https?:\/\/\S+$/i.test(value) ||
    /^\/uploads\/[A-Za-z0-9._\/-]+$/.test(value) ||
    value.startsWith('data:image/') ||
    value.startsWith('data:video/'),
  'Invalid media URL format'
);

export const createPostSchema = z.object({
  content: z.string().max(2200, 'Content cannot exceed 2200 characters').optional(),
  imageUrl: storedImageUrlSchema.optional()
}).refine(
  data =>
    Boolean(data.content?.trim()) ||
    Boolean(data.imageUrl?.trim()),
  {
    message: 'Post must contain either text content or an image URL',
    path: ['content']
  }
);
