import dotenv from 'dotenv';
// Load environment variables from .env file in non-production environments
dotenv.config();
const isProduction = process.env.NODE_ENV === 'production';
const useMockData = process.env.USE_MOCK_DATA === 'true';
/**
 * Retrieves environment variable or enforces strict missing-variable failure in production.
 */
function getRequiredEnv(key: string, altKeys: string[] = []): string {
  const value = process.env[key] || altKeys.map(k => process.env[k]).find(Boolean);
  if (!value && isProduction && !useMockData) {
    console.error(`[CRITICAL SECURITY FAILURE] Mandatory environment variable is missing: ${key}`);
  }
  return value || '';
}
// Strict Production Secret Enforcement
if (isProduction && !useMockData) {
  const missingSecrets: string[] = [];
  if (!process.env.JWT_SECRET) missingSecrets.push('JWT_SECRET');
  if (!process.env.JWT_REFRESH_SECRET) missingSecrets.push('JWT_REFRESH_SECRET');
  const hasDbUser = Boolean(process.env.DB_USER || process.env.ORACLE_DB_USER);
  const hasDbPass = Boolean(process.env.DB_PASSWORD || process.env.ORACLE_DB_PASSWORD);
  const hasDbConn = Boolean(process.env.DB_CONNECT_STRING || process.env.ORACLE_DB_CONNECTION_STRING);
  if (!hasDbUser) missingSecrets.push('DB_USER (or ORACLE_DB_USER)');
  if (!hasDbPass) missingSecrets.push('DB_PASSWORD (or ORACLE_DB_PASSWORD)');
  if (!hasDbConn) missingSecrets.push('DB_CONNECT_STRING (or ORACLE_DB_CONNECTION_STRING)');
  if (missingSecrets.length > 0) {
    console.error(`[FATAL ERROR] Production deployment halted. Missing required production secrets:\n  - ${missingSecrets.join('\n  - ')}`);
    process.exit(1);
  }
}
export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '4000', 10),
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'https://nexa-social-app.surge.sh',
  // JWT Configuration (Strictly requires environment variable in production)
  JWT_SECRET: getRequiredEnv('JWT_SECRET'),
  JWT_REFRESH_SECRET: getRequiredEnv('JWT_REFRESH_SECRET'),
  // Oracle Database Credentials (Mapped to render.yaml secret definitions)
  ORACLE_DB_USER: process.env.DB_USER || process.env.ORACLE_DB_USER || '',
  ORACLE_DB_PASSWORD: process.env.DB_PASSWORD || process.env.ORACLE_DB_PASSWORD || '',
  ORACLE_DB_CONNECTION_STRING: process.env.DB_CONNECT_STRING || process.env.ORACLE_DB_CONNECTION_STRING || '',
  USE_MOCK_DATA: useMockData
};
