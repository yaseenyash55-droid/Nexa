import { env } from '../config/env.js';
import { IRepositoryManager } from './types.js';
import { oracleRepositoryManager } from './oracle/oracle.repo.js';
import { postgresRepositoryManager } from './postgres/postgres.repo.js';

export function getRepositoryManager(): IRepositoryManager {
  if (env.DATABASE_PROVIDER === 'postgres') {
    return postgresRepositoryManager;
  }
  return oracleRepositoryManager;
}

export { oracleRepositoryManager } from './oracle/oracle.repo.js';
export { postgresRepositoryManager } from './postgres/postgres.repo.js';
