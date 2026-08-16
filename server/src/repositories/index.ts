import { IRepositoryManager } from './types.js';
import { oracleRepositoryManager } from './oracle/oracle.repo.js';

export function getRepositoryManager(): IRepositoryManager {
  return oracleRepositoryManager;
}
