import { IRepositoryManager } from './types.js';
import { mockRepositoryManager } from './mock/mock.repo.js';
import { oracleRepositoryManager } from './oracle/oracle.repo.js';

export function getRepositoryManager(): IRepositoryManager {
  const isCloudHost = process.env.NODE_ENV === 'production' ||
                      process.env.USE_MOCK_DATA === 'true' ||
                      !process.env.ORACLE_DB_USER ||
                      process.env.ORACLE_DB_CONNECTION_STRING?.includes('localhost');
  if (isCloudHost) {
    return mockRepositoryManager;
  }
  try {
    return oracleRepositoryManager;
  } catch (err) {
    console.warn('Oracle DB not available in cloud environment, falling back to repository manager:', err);
    return mockRepositoryManager;
  }
}
