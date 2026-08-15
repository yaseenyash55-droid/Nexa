import { z } from 'zod';

export const createCommentSchema = z.object({
  content: z.string().min(1, 'Comment content cannot be empty').max(1000, 'Comment cannot exceed 1000 characters')
});
