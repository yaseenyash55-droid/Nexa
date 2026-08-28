import { z } from 'zod';

export const chatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1, 'Message content cannot be empty').max(4000, 'Message content cannot exceed 4000 characters')
});

export const aiChatSchema = z.object({
  message: z.string()
    .min(1, 'Message cannot be empty')
    .max(4000, 'Message cannot exceed 4000 characters'),
  conversationId: z.number().int().positive().optional()
});

export const aiStreamChatSchema = z.object({
  message: z.string()
    .min(1, 'Message cannot be empty')
    .max(4000, 'Message cannot exceed 4000 characters'),
  conversationId: z.number().int().positive().optional()
});

export const AI_WRITING_OPERATIONS = [
  'generate_caption',
  'improve_writing',
  'fix_grammar',
  'shorten',
  'make_professional',
  'make_casual',
  'generate_hashtags',
  'translate'
] as const;

export type AiWritingOperation = typeof AI_WRITING_OPERATIONS[number];

export const aiWritingSchema = z.object({
  operation: z.enum(AI_WRITING_OPERATIONS, {
    errorMap: () => ({ message: `Operation must be one of: ${AI_WRITING_OPERATIONS.join(', ')}` })
  }),
  text: z.string().max(4000, 'Text cannot exceed 4000 characters').optional().default(''),
  targetLanguage: z.string().max(50).optional()
});

export const aiConversationParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Conversation ID must be a positive integer')
});

export const aiMemoryParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Memory ID must be a positive integer')
});

export const aiPreferencesSchema = z.object({
  personalizationEnabled: z.boolean().optional(),
  preferredLanguage: z.string().min(1).max(50).optional(),
  responseLength: z.enum(['concise', 'balanced', 'detailed']).optional(),
  writingTone: z.string().min(1).max(50).optional()
});

export const aiCreateMemorySchema = z.object({
  keyName: z.string().min(1, 'Key name cannot be empty').max(80, 'Key name cannot exceed 80 characters'),
  content: z.string().min(1, 'Memory content cannot be empty').max(1000, 'Memory content cannot exceed 1000 characters'),
  category: z.string().max(50).optional().default('general')
});

export const aiCreateConversationSchema = z.object({
  title: z.string().max(100, 'Title cannot exceed 100 characters').optional()
});

export type AiChatInput = z.infer<typeof aiChatSchema>;
export type AiStreamChatInput = z.infer<typeof aiStreamChatSchema>;
export type AiWritingInput = z.infer<typeof aiWritingSchema>;
export type AiPreferencesInput = z.infer<typeof aiPreferencesSchema>;
export type AiCreateMemoryInput = z.infer<typeof aiCreateMemorySchema>;
export type AiCreateConversationInput = z.infer<typeof aiCreateConversationSchema>;
