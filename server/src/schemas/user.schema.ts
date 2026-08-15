import { z } from 'zod';

export const updateProfileSchema = z.object({
  displayName: z.string().min(2).max(60).optional(),
  bio: z.string().max(500).optional(),
  profileImageUrl: z.string().nullable().optional(),
  coverImageUrl: z.string().nullable().optional(),
  location: z.string().max(100).nullable().optional(),
  websiteUrl: z.string().nullable().optional()
});
