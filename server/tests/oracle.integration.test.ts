import { describe, it, expect, beforeAll } from 'vitest';
import { OracleUserRepository } from '../src/repositories/oracle/user.oracle.repo.js';
import { OraclePostRepository } from '../src/repositories/oracle/post.oracle.repo.js';
import { checkOracleHealth, initializeOraclePool, closeOraclePool } from '../src/db/pool.js';
import { env } from '../src/config/env.js';

describe('Oracle Repository Integration Suite', () => {
  let isOracleLive = false;
  let userRepo: OracleUserRepository;
  let postRepo: OraclePostRepository;

  beforeAll(async () => {
    if (env.DATA_SOURCE === 'oracle') {
      try {
        await initializeOraclePool();
        const health = await checkOracleHealth();
        isOracleLive = health.reachable;
      } catch {
        isOracleLive = false;
      }
    }
    userRepo = new OracleUserRepository();
    postRepo = new OraclePostRepository();
  });

  it('should report database reachability status without throwing secrets', async () => {
    const health = await checkOracleHealth();
    expect(health).toHaveProperty('reachable');
    expect(health).toHaveProperty('details');
    expect(health.details).not.toContain(env.DB_PASSWORD);
  });

  it('should instantiate Oracle repositories without error', () => {
    expect(userRepo).toBeDefined();
    expect(postRepo).toBeDefined();
  });

  it('should execute integration tests when Oracle connection is active', async () => {
    if (!isOracleLive) {
      console.log('Skipping live Oracle query assertions because Oracle listener is unreachable or credentials are not yet migrated.');
      return;
    }

    const testUsername = 'oracle_test_' + Date.now();
    const newUser = await userRepo.createUser({
      username: testUsername,
      email: `${testUsername}@nexa.app`,
      passwordHash: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
      displayName: 'Oracle Integration Test User'
    });

    expect(newUser.userId).toBeGreaterThan(0);
    expect(newUser.username).toBe(testUsername);

    const fetched = await userRepo.findByUsername(testUsername);
    expect(fetched).not.toBeNull();
    expect(fetched?.email).toBe(`${testUsername}@nexa.app`);
  });
});
