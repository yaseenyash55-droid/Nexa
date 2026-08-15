import { IRepositoryManager } from './types.js';
import { mockRepositoryManager } from './mock/mock.repo.js';
import { oracleRepositoryManager } from './oracle/oracle.repo.js';

import { env } from '../config/env.js';

export function getRepositoryManager(): IRepositoryManager {
  if (env.DATA_SOURCE === 'mock') {
    return mockRepositoryManager;
  }
  try {
    return oracleRepositoryManager;
  } catch (err) {
    console.warn('Oracle DB not available, falling back to mock repository manager:', err);
    return mockRepositoryManager;
  }
}
