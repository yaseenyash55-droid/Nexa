import { z } from 'zod';

export const createPostSchema = z.object({
  content: z.string().max(2000, 'Content cannot exceed 2000 characters').optional(),
  imageUrl: z.string().url('Invalid image URL format').or(z.literal('')).optional()
}).refine(data => (data.content && data.content.trim().length > 0) || (data.imageUrl && data.imageUrl.trim().length > 0), {
  message: 'Post must contain either text content or an image URL',
  path: ['content']
});
