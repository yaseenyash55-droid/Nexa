import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.body',
      'req.headers.cookie',
      'password',
      'passwordHash',
      'token',
      'accessToken',
      'refreshToken',
      'DB_PASSWORD',
      'DB_CONNECT_STRING',
      'ORACLE_DB_PASSWORD',
      'ORACLE_DB_CONNECTION_STRING',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
      'body.password',
      'cookies.nexa_refresh_token'
    ],
    censor: '[REDACTED]'
  },
  transport: process.env.NODE_ENV !== 'production' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
      translateTime: 'SYS:standard'
    }
  } : undefined
});
