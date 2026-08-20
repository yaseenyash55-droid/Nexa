import dotenv from 'dotenv';

dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

export function getRequiredEnv(keys: string[], label: string, enforceRequired = isProduction): string {
  for (const key of keys) {
    const value = process.env[key];

    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }

  if (enforceRequired) {
    throw new Error(
      `[FATAL CONFIGURATION ERROR] Missing required environment variable: ${label}`
    );
  }

  return '';
}

export function getPositiveInteger(key: string, fallback: number): number {
  const rawValue = process.env[key];

  if (!rawValue) {
    return fallback;
  }

  const value = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `[FATAL CONFIGURATION ERROR] ${key} must be a positive integer`
    );
  }

  return value;
}

export function validateProductionConnectString(connectString: string, enforceProd = isProduction): void {
  if (!enforceProd) {
    return;
  }

  if (!connectString || connectString.trim().length === 0) {
    throw new Error(
      '[FATAL CONFIGURATION ERROR] Missing required environment variable: DB_CONNECT_STRING'
    );
  }

  const normalized = connectString.toLowerCase().trim();
  const loopbackPatterns = [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '::1',
  ];

  for (const pattern of loopbackPatterns) {
    if (normalized.includes(pattern)) {
      throw new Error(
        `[FATAL CONFIGURATION ERROR] Production DB_CONNECT_STRING targets local loopback (${pattern}). A secure, remotely reachable Oracle instance (e.g. TCPS with TLS or Cloud ADB) is required.`
      );
    }
  }
}

const jwtAccessSecret = getRequiredEnv(
  ['JWT_SECRET', 'JWT_ACCESS_SECRET'],
  'JWT_SECRET'
);

const jwtRefreshSecret = getRequiredEnv(
  ['JWT_REFRESH_SECRET'],
  'JWT_REFRESH_SECRET'
);

const databaseUser = getRequiredEnv(
  ['DB_USER', 'ORACLE_DB_USER'],
  'DB_USER'
);

const databasePassword = getRequiredEnv(
  ['DB_PASSWORD', 'ORACLE_DB_PASSWORD'],
  'DB_PASSWORD'
);

const databaseConnectString = getRequiredEnv(
  ['DB_CONNECT_STRING', 'ORACLE_DB_CONNECTION_STRING'],
  'DB_CONNECT_STRING'
);

const walletLocation = process.env.TNS_ADMIN || process.env.ORACLE_WALLET_LOCATION || process.env.WALLET_LOCATION || '';
const walletPassword = process.env.WALLET_PASSWORD || '';

// Validate connect string against localhost in production mode
validateProductionConnectString(databaseConnectString, isProduction);

export const env = {
  NODE_ENV: nodeEnv,
  PORT: getPositiveInteger('PORT', 4000),
  CLIENT_ORIGIN:
    process.env.CLIENT_ORIGIN || 'https://nexa-social-app.surge.sh',

  JWT_SECRET: jwtAccessSecret,
  JWT_ACCESS_SECRET: jwtAccessSecret,
  JWT_REFRESH_SECRET: jwtRefreshSecret,

  DB_USER: databaseUser,
  DB_PASSWORD: databasePassword,
  DB_CONNECT_STRING: databaseConnectString,

  ORACLE_DB_USER: databaseUser,
  ORACLE_DB_PASSWORD: databasePassword,
  ORACLE_DB_CONNECTION_STRING: databaseConnectString,

  TNS_ADMIN: walletLocation,
  WALLET_LOCATION: walletLocation,
  WALLET_PASSWORD: walletPassword,

  DB_POOL_MIN: getPositiveInteger('DB_POOL_MIN', 1),
  DB_POOL_MAX: getPositiveInteger('DB_POOL_MAX', 5),
  DB_POOL_INCREMENT: getPositiveInteger('DB_POOL_INCREMENT', 1),

  BCRYPT_ROUNDS: getPositiveInteger('BCRYPT_ROUNDS', 12),
  REFRESH_TOKEN_TTL_DAYS: getPositiveInteger(
    'REFRESH_TOKEN_TTL_DAYS',
    7
  ),

  COOKIE_SECURE:
    isProduction || process.env.COOKIE_SECURE === 'true',

  DATA_SOURCE: 'oracle' as const,
  USE_MOCK_DATA: false
};
