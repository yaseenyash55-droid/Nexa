import pg from 'pg';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const { Pool, types } = pg;

// Parse PostgreSQL BIGINT (int8, oid 20) as JavaScript number instead of string for numeric IDs
types.setTypeParser(20, (val: string) => (val === null ? null : Number.parseInt(val, 10)));

let pool: pg.Pool | null = null;

export function sanitizePostgresUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  return rawUrl.replace(/(postgres(?:ql)?:\/\/[^:]+:)([^@]+)(@)/, '$1***$3');
}

export async function initializePostgresPool(): Promise<void> {
  if (pool) {
    return;
  }

  try {
    const poolConfig: pg.PoolConfig = {
      connectionString: env.DATABASE_URL,
      min: env.PG_POOL_MIN,
      max: env.PG_POOL_MAX,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    };

    if (env.PG_SSL) {
      poolConfig.ssl = {
        rejectUnauthorized: false
      };
    }

    pool = new Pool(poolConfig);

    pool.on('error', (err) => {
      logger.error({ err }, 'Unexpected PostgreSQL pool error on idle client');
    });

    // Verify connection on startup
    const client = await pool.connect();
    try {
      await client.query('SELECT 1 AS alive');
    } finally {
      client.release();
    }

    logger.info(
      {
        url: sanitizePostgresUrl(env.DATABASE_URL),
        ssl: Boolean(env.PG_SSL),
        maxPool: env.PG_POOL_MAX
      },
      'PostgreSQL connection pool initialized successfully'
    );
  } catch (err) {
    logger.error({ err }, 'Failed to initialize PostgreSQL connection pool');
    throw err;
  }
}

export async function closePostgresPool(): Promise<void> {
  if (pool) {
    try {
      await pool.end();
      pool = null;
      logger.info('PostgreSQL connection pool closed gracefully');
    } catch (err) {
      logger.error({ err }, 'Error closing PostgreSQL connection pool');
    }
  }
}

export function getPostgresPool(): pg.Pool {
  if (!pool) {
    throw new Error('PostgreSQL Connection Pool is not initialized');
  }
  return pool;
}

export async function getPostgresClient(): Promise<pg.PoolClient> {
  const p = getPostgresPool();
  return p.connect();
}

export async function executePostgresSql<T extends pg.QueryResultRow = any>(
  sql: string,
  params: any[] = []
): Promise<{ rows: T[]; rowCount: number }> {
  const p = getPostgresPool();
  try {
    const result = await p.query<T>(sql, params);
    return {
      rows: result.rows,
      rowCount: result.rowCount ?? result.rows.length
    };
  } catch (err) {
    logger.error({ err, sql }, 'PostgreSQL query execution error');
    throw err;
  }
}

export async function withPostgresTransaction<T>(
  action: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPostgresClient();
  try {
    await client.query('BEGIN');
    const result = await action(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rErr) {
      logger.error({ rErr }, 'Error rolling back PostgreSQL transaction');
    }
    throw err;
  } finally {
    client.release();
  }
}

export async function checkPostgresHealth(): Promise<{
  reachable: boolean;
  details: string;
}> {
  if (!pool) {
    return { reachable: false, details: 'Database pool not initialized' };
  }
  let client: pg.PoolClient | null = null;
  try {
    client = await pool.connect();
    const res = await client.query('SELECT 1 AS alive');
    if (res.rows && res.rows.length > 0) {
      return { reachable: true, details: 'Connected' };
    }
    return { reachable: false, details: 'Database unreachable' };
  } catch (err) {
    logger.error({ err }, 'PostgreSQL health ping failure');
    return { reachable: false, details: 'Database unreachable' };
  } finally {
    if (client) {
      try {
        client.release();
      } catch {
        // ignore release errors
      }
    }
  }
}
