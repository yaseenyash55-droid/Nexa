import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';
import { logger } from '../utils/logger.js';

// Load .env from workspace root if exists
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

const isTestEnvironment = process.env.NODE_ENV === 'test';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  DATA_SOURCE: z.enum(['oracle', 'mock']).default('oracle'),

  // Oracle settings
  DB_USER: z.string().default('NEXA_USER'),
  DB_PASSWORD: z.string().min(1).default(isTestEnvironment ? 'test-only-db-password' : ''),
  DB_CONNECT_STRING: z.string().default('localhost:1521/FREEPDB1'),
  DB_POOL_MIN: z.coerce.number().default(1),
  DB_POOL_MAX: z.coerce.number().default(5),
  DB_POOL_INCREMENT: z.coerce.number().default(1),

  // Auth settings
  JWT_ACCESS_SECRET: z.string().min(32).default(isTestEnvironment ? 'test-only-access-secret-not-for-production' : ''),
  JWT_REFRESH_SECRET: z.string().min(32).default(isTestEnvironment ? 'test-only-refresh-secret-not-for-production' : ''),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(7),
  BCRYPT_ROUNDS: z.coerce.number().default(12),
  COOKIE_SECURE: z.coerce.boolean().default(false),

  MFA_ENCRYPTION_KEY: z.string().min(32).optional(),
  LOG_LEVEL: z.string().default('info')
}).superRefine((config, context) => {
  if (config.NODE_ENV !== 'production') return;
  if (config.DATA_SOURCE !== 'oracle') {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['DATA_SOURCE'], message: 'Production requires DATA_SOURCE=oracle' });
  }
  if (config.DB_PASSWORD === 'replace_with_secure_password') {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['DB_PASSWORD'], message: 'Production requires a unique Oracle password' });
  }
  if (config.JWT_ACCESS_SECRET.startsWith('nexa_') || config.JWT_REFRESH_SECRET.startsWith('nexa_')) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['JWT_ACCESS_SECRET'], message: 'Production requires independently generated JWT secrets' });
  }
  if (!config.COOKIE_SECURE) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['COOKIE_SECURE'], message: 'Production requires secure cookies' });
  }
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  logger.error({ errors: parsedEnv.error.format() }, 'Invalid environment configuration');
  throw new Error('Environment configuration validation failed');
}

const staticEnv = parsedEnv.data;

export const env = {
  ...staticEnv,
  get DATA_SOURCE(): 'oracle' | 'mock' {
    return (process.env.DATA_SOURCE as 'oracle' | 'mock') || staticEnv.DATA_SOURCE;
  }
};
