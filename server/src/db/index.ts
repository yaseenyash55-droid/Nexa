import { env } from '../config/env.js';
import { initializeOraclePool, closeOraclePool, checkOracleHealth, withTransaction } from './pool.js';
import { initializePostgresPool, closePostgresPool, checkPostgresHealth, withPostgresTransaction } from './postgres.pool.js';

export async function initializeDatabasePool(): Promise<void> {
  if (env.DATABASE_PROVIDER === 'postgres') {
    await initializePostgresPool();
  } else {
    await initializeOraclePool();
  }
}

export async function closeDatabasePool(): Promise<void> {
  if (env.DATABASE_PROVIDER === 'postgres') {
    await closePostgresPool();
  } else {
    await closeOraclePool();
  }
}

export async function checkDatabaseHealth(): Promise<{
  provider: 'postgres' | 'oracle';
  reachable: boolean;
  details: string;
}> {
  if (env.DATABASE_PROVIDER === 'postgres') {
    const health = await checkPostgresHealth();
    return {
      provider: 'postgres',
      reachable: health.reachable,
      details: health.details
    };
  }

  const health = await checkOracleHealth();
  return {
    provider: 'oracle',
    reachable: health.reachable,
    details: health.details
  };
}

export async function withDatabaseTransaction<T>(
  callback: (connection: any) => Promise<T>
): Promise<T> {
  if (env.DATABASE_PROVIDER === 'postgres') {
    return withPostgresTransaction(callback);
  }
  return withTransaction(callback);
}

export { initializeOraclePool, closeOraclePool, checkOracleHealth, withTransaction } from './pool.js';
export { initializePostgresPool, closePostgresPool, checkPostgresHealth, withPostgresTransaction } from './postgres.pool.js';
