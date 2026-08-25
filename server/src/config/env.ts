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

function getBoolean(key: string, fallback = false): boolean {
  const value = process.env[key];
  if (value === undefined) return fallback;
  return value.trim().toLowerCase() === 'true';
}

function getCsv(key: string, fallback = ''): string[] {
  return (process.env[key] || fallback)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
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

const rawDatabaseProvider = (
  process.env.DATABASE_PROVIDER ||
  (process.env.DATABASE_URL ? 'postgres' : 'oracle')
).toLowerCase().trim();

export const databaseProvider: 'postgres' | 'oracle' =
  rawDatabaseProvider === 'postgres' || rawDatabaseProvider === 'postgresql' || rawDatabaseProvider === 'pg'
    ? 'postgres'
    : 'oracle';

const isPostgres = databaseProvider === 'postgres';
const isOracle = databaseProvider === 'oracle';

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL || '';

if (isProduction && isPostgres && !databaseUrl) {
  throw new Error(
    '[FATAL CONFIGURATION ERROR] Missing required environment variable: DATABASE_URL for PostgreSQL provider in production'
  );
}

const databaseUser = getRequiredEnv(
  ['DB_USER', 'ORACLE_DB_USER', 'ORACLE_USER'],
  'DB_USER',
  isProduction && isOracle
);

const databasePassword = getRequiredEnv(
  ['DB_PASSWORD', 'ORACLE_DB_PASSWORD', 'ORACLE_PASSWORD'],
  'DB_PASSWORD',
  isProduction && isOracle
);

const databaseConnectString = getRequiredEnv(
  [
    'DB_CONNECT_STRING',
    'ORACLE_CONNECT_STRING',
    'ORACLE_DB_CONNECTION_STRING',
    'ORACLE_DB_CONNECT_STRING'
  ],
  'DB_CONNECT_STRING',
  isProduction && isOracle
);

const walletLocation =
  process.env.TNS_ADMIN ||
  process.env.ORACLE_WALLET_LOCATION ||
  process.env.WALLET_LOCATION ||
  process.env.WALLET_DIR ||
  '';
const walletPassword = process.env.WALLET_PASSWORD || '';

// Validate connect string against localhost in production mode if Oracle is active
if (isOracle) {
  validateProductionConnectString(databaseConnectString, isProduction);
}

const rawStorageProvider = (
  process.env.STORAGE_PROVIDER ||
  (isProduction && process.env.S3_BUCKET ? 's3' : 'local')
).toLowerCase().trim();

export function normalizeStorageProvider(provider: string): 's3' | 'local' {
  const p = provider.toLowerCase().trim();
  if (p === 'oci_object_storage' || p === 's3_compatible' || p === 's3' || p === 'oci') {
    return 's3';
  }
  return 'local';
}

const storageProvider = normalizeStorageProvider(rawStorageProvider);

export function validateStorageConfiguration(
  provider: 's3' | 'local',
  enforceProd = isProduction
): void {
  if (provider === 'local' && enforceProd) {
    throw new Error(
      '[FATAL CONFIGURATION ERROR] Local disk storage provider is not permitted in production. S3 or OCI Object Storage must be configured.'
    );
  }
  if (provider === 's3' && enforceProd) {
    const endpoint = process.env.S3_ENDPOINT || process.env.OCI_OBJECT_STORAGE_ENDPOINT;
    const bucket = process.env.S3_BUCKET || process.env.OCI_BUCKET_NAME || process.env.OCI_OBJECT_STORAGE_BUCKET;
    const accessKeyId = process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || process.env.OCI_CUSTOMER_SECRET_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || process.env.OCI_CUSTOMER_SECRET_KEY;

    const missing: string[] = [];
    if (!endpoint) missing.push('S3_ENDPOINT');
    if (!bucket) missing.push('S3_BUCKET');
    if (!accessKeyId) missing.push('S3_ACCESS_KEY_ID');
    if (!secretAccessKey) missing.push('S3_SECRET_ACCESS_KEY');

    if (missing.length > 0) {
      throw new Error(
        `[FATAL CONFIGURATION ERROR] Missing required persistent storage configuration: ${missing.join(', ')}`
      );
    }
  }
}

// Run validation for storage configuration
validateStorageConfiguration(storageProvider, isProduction);

const s3Endpoint =
  process.env.S3_ENDPOINT ||
  process.env.OCI_OBJECT_STORAGE_ENDPOINT ||
  '';

const s3Region =
  process.env.S3_REGION ||
  process.env.AWS_REGION ||
  'us-ashburn-1';

const s3Bucket =
  process.env.S3_BUCKET ||
  process.env.OCI_BUCKET_NAME ||
  process.env.OCI_OBJECT_STORAGE_BUCKET ||
  '';

const s3AccessKeyId =
  process.env.S3_ACCESS_KEY_ID ||
  process.env.AWS_ACCESS_KEY_ID ||
  process.env.OCI_CUSTOMER_SECRET_KEY_ID ||
  '';

const s3SecretAccessKey =
  process.env.S3_SECRET_ACCESS_KEY ||
  process.env.AWS_SECRET_ACCESS_KEY ||
  process.env.OCI_CUSTOMER_SECRET_KEY ||
  '';

const cdnBaseUrl = process.env.CDN_BASE_URL || '';

const webRtcCallingRequested = getBoolean('WEBRTC_CALLING_ENABLED');
const webRtcStunUrls = getCsv(
  'WEBRTC_STUN_URLS',
  'stun:stun.l.google.com:19302'
);
const webRtcTurnUrls = getCsv('WEBRTC_TURN_URLS');
const webRtcTurnUsername = process.env.WEBRTC_TURN_USERNAME?.trim() || '';
const webRtcTurnCredential = process.env.WEBRTC_TURN_CREDENTIAL?.trim() || '';
const webRtcTurnSharedSecret = process.env.WEBRTC_TURN_SHARED_SECRET?.trim() || '';
const webRtcTurnCredentialTtlSeconds = Math.min(
  getPositiveInteger('WEBRTC_TURN_CREDENTIAL_TTL_SECONDS', 3600),
  86_400
);
const webRtcCallingConfigured =
  webRtcCallingRequested &&
  webRtcTurnUrls.length > 0 &&
  (
    webRtcTurnSharedSecret.length > 0 ||
    (webRtcTurnUsername.length > 0 && webRtcTurnCredential.length > 0)
  );

export const env = {
  NODE_ENV: nodeEnv,
  PORT: getPositiveInteger('PORT', 4000),
  CLIENT_ORIGIN:
    process.env.CLIENT_ORIGIN || 'https://nexa-social-app.surge.sh',

  JWT_SECRET: jwtAccessSecret,
  JWT_ACCESS_SECRET: jwtAccessSecret,
  JWT_REFRESH_SECRET: jwtRefreshSecret,

  DATABASE_PROVIDER: databaseProvider,
  DATABASE_URL: databaseUrl,
  PG_POOL_MIN: getPositiveInteger('PG_POOL_MIN', 1),
  PG_POOL_MAX: getPositiveInteger('PG_POOL_MAX', 10),
  PG_SSL: process.env.PG_SSL === 'false' ? false : (isProduction || databaseUrl.includes('sslmode') || databaseUrl.includes('supabase') || databaseUrl.includes('neon') || databaseUrl.includes('render')),

  DB_USER: databaseUser,
  DB_PASSWORD: databasePassword,
  DB_CONNECT_STRING: databaseConnectString,

  ORACLE_USER: databaseUser,
  ORACLE_PASSWORD: databasePassword,
  ORACLE_CONNECT_STRING: databaseConnectString,
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

  STORAGE_PROVIDER: storageProvider,
  S3_ENDPOINT: s3Endpoint,
  S3_REGION: s3Region,
  S3_BUCKET: s3Bucket,
  S3_ACCESS_KEY_ID: s3AccessKeyId,
  S3_SECRET_ACCESS_KEY: s3SecretAccessKey,
  CDN_BASE_URL: cdnBaseUrl,

  WEBRTC_CALLING_ENABLED: webRtcCallingConfigured,
  WEBRTC_CALLING_REQUESTED: webRtcCallingRequested,
  WEBRTC_STUN_URLS: webRtcStunUrls,
  WEBRTC_TURN_URLS: webRtcTurnUrls,
  WEBRTC_TURN_USERNAME: webRtcTurnUsername,
  WEBRTC_TURN_CREDENTIAL: webRtcTurnCredential,
  WEBRTC_TURN_SHARED_SECRET: webRtcTurnSharedSecret,
  WEBRTC_TURN_CREDENTIAL_TTL_SECONDS: webRtcTurnCredentialTtlSeconds,

  REDIS_URL: process.env.REDIS_URL || '',

  DATA_SOURCE: databaseProvider,
  USE_MOCK_DATA: false
};
