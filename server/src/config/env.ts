import dotenv from 'dotenv';
dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'production';
const jwtSecret = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET || 'nexa_super_secret_jwt_key_production_2026';
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'nexa_super_secret_refresh_jwt_key_2026';
const oracleDbUser = process.env.ORACLE_DB_USER || process.env.DB_USER || 'c##nexa_user';
const oracleDbPassword = process.env.ORACLE_DB_PASSWORD || process.env.DB_PASSWORD || 'nexa_pass_123';
const oracleDbConnectionString = process.env.ORACLE_DB_CONNECTION_STRING || process.env.DB_CONNECT_STRING || 'localhost:1521/XE';

if (nodeEnv === 'production') {
  if (!process.env.JWT_SECRET && !process.env.JWT_ACCESS_SECRET) {
    console.error('[CRITICAL SECURITY ERROR] Production startup blocked: JWT_ACCESS_SECRET must be explicitly set in environment variables.');
  }
  if (!process.env.JWT_REFRESH_SECRET) {
    console.error('[CRITICAL SECURITY ERROR] Production startup blocked: JWT_REFRESH_SECRET must be explicitly set in environment variables.');
  }
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'production',
  PORT: parseInt(process.env.PORT || '4000', 10),
  JWT_SECRET: jwtSecret,
  JWT_ACCESS_SECRET: jwtSecret,
  JWT_REFRESH_SECRET: jwtRefreshSecret,
  ORACLE_DB_USER: oracleDbUser,
  ORACLE_DB_PASSWORD: oracleDbPassword,
  ORACLE_DB_CONNECTION_STRING: oracleDbConnectionString,
  DB_USER: oracleDbUser,
  DB_PASSWORD: oracleDbPassword,
  DB_CONNECT_STRING: oracleDbConnectionString,
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'https://nexa-social-app.surge.sh',
  DB_POOL_MIN: parseInt(process.env.DB_POOL_MIN || '1', 10),
  DB_POOL_MAX: parseInt(process.env.DB_POOL_MAX || '5', 10),
  DB_POOL_INCREMENT: parseInt(process.env.DB_POOL_INCREMENT || '1', 10),
  BCRYPT_ROUNDS: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  REFRESH_TOKEN_TTL_DAYS: parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || '7', 10),
  COOKIE_SECURE: process.env.COOKIE_SECURE === 'true'
};
