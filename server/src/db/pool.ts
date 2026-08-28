import oracledb, { Result } from 'oracledb';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

// Enable Thin mode by default (no Instant Client binary required)
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.autoCommit = false;

let pool: any = null;

export function sanitizeConnectString(rawConnectString: string): string {
  if (!rawConnectString) return '';
  return rawConnectString
    .replace(/:[^:@/]+@/g, ':***@')
    .replace(/\/\/([^:@/]+):([^:@/]+)@/g, '//$1:***@');
}

export async function initializeOraclePool(): Promise<void> {
  try {
    const poolConfig: any = {
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      connectString: env.DB_CONNECT_STRING,
      poolMin: env.DB_POOL_MIN,
      poolMax: env.DB_POOL_MAX,
      poolIncrement: env.DB_POOL_INCREMENT
    };

    if (env.WALLET_LOCATION) {
      poolConfig.configDir = env.WALLET_LOCATION;
      poolConfig.walletLocation = env.WALLET_LOCATION;
      if (env.WALLET_PASSWORD) {
        poolConfig.walletPassword = env.WALLET_PASSWORD;
      }
    }

    pool = await oracledb.createPool(poolConfig);
    logger.info(
      {
        connectString: sanitizeConnectString(env.DB_CONNECT_STRING),
        walletConfigured: Boolean(env.WALLET_LOCATION)
      },
      'Oracle Database connection pool initialized successfully'
    );
  } catch (err) {
    logger.error({ err }, 'Failed to initialize Oracle Database connection pool');
    throw err;
  }
}

export async function closeOraclePool(): Promise<void> {
  if (pool) {
    try {
      await pool.close(10);
      pool = null;
      logger.info('Oracle Database connection pool closed gracefully');
    } catch (err) {
      logger.error({ err }, 'Error closing Oracle Database connection pool');
    }
  }
}

export function isOraclePoolInitialized(): boolean {
  return pool !== null;
}

export async function getConnection(): Promise<any> {
  if (!pool) {
    throw new Error('Oracle Connection Pool is not initialized');
  }
  return pool.getConnection();
}

export async function executeSql<T = any>(
  sql: string,
  binds: Record<string, any> | any[] = {},
  options: Record<string, any> = {}
): Promise<Result<T>> {
  let connection: any = null;
  try {
    connection = await getConnection();
    const result = await connection.execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      autoCommit: true,
      ...options
    });
    return result;
  } catch (err) {
    logger.error({ err, sql }, 'Oracle SQL execution error');
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (cErr) {
        logger.error({ cErr }, 'Error closing connection');
      }
    }
  }
}

export async function withTransaction<T>(action: (conn: any) => Promise<T>): Promise<T> {
  let connection: any = null;
  try {
    connection = await getConnection();
    const result = await action(connection);
    await connection.commit();
    return result;
  } catch (err) {
    if (connection) {
      try {
        await connection.rollback();
      } catch (rErr) {
        logger.error({ rErr }, 'Error rolling back transaction');
      }
    }
    throw err;
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (cErr) {
        logger.error({ cErr }, 'Error closing transaction connection');
      }
    }
  }
}

export async function checkOracleHealth(): Promise<{
  reachable: boolean;
  details: string;
}> {
  if (!pool) {
    return { reachable: false, details: 'Database unreachable' };
  }
  let conn: any = null;
  try {
    conn = await pool.getConnection();
    const res = await conn.execute('SELECT 1 AS ALIVE FROM DUAL');
    if (res.rows && res.rows.length > 0) {
      return { reachable: true, details: 'Connected' };
    }
    return { reachable: false, details: 'Database unreachable' };
  } catch (err) {
    logger.error({ err }, 'Oracle DB health ping failure');
    return { reachable: false, details: 'Database unreachable' };
  } finally {
    if (conn) {
      try {
        await conn.close();
      } catch {
        // ignore close error
      }
    }
  }
}
