import { z } from 'zod';

export const updateProfileSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username cannot exceed 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .optional(),
  displayName: z.string().min(2, 'Display name must be at least 2 characters').max(60, 'Display name cannot exceed 60 characters').optional(),
  bio: z.string().max(500, 'Bio cannot exceed 500 characters').optional(),
  profileImageUrl: z.string().nullable().optional(),
  coverImageUrl: z.string().nullable().optional(),
  location: z.string().max(100).nullable().optional(),
  websiteUrl: z.string().nullable().optional()
});
