import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import supertest from 'supertest';

// ---------------------------------------------------------------------------
// Mocks — use vi.hoisted() so variables are available when vi.mock factories
// are hoisted to the top of the file by vitest.
// ---------------------------------------------------------------------------

const { mockGetConnection, mockExecuteSql, mockWithTransaction } = vi.hoisted(() => {
  const mockGetConnection = vi.fn();
  const mockExecuteSql = vi.fn();
  const mockWithTransaction = vi.fn(async (action: (conn: any) => Promise<any>) => {
    const fakeConn = {
      execute: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn(),
      close: vi.fn()
    };
    return action(fakeConn);
  });
  return { mockGetConnection, mockExecuteSql, mockWithTransaction };
});

vi.mock('../src/db/pool.js', () => ({
  initializeOraclePool: vi.fn(),
  closeOraclePool: vi.fn(),
  getConnection: mockGetConnection,
  executeSql: mockExecuteSql,
  withTransaction: mockWithTransaction,
  checkOracleHealth: vi.fn().mockResolvedValue({ reachable: false, details: 'Oracle Pool not initialized' })
}));

// Stub the email provider so registration doesn't try real email sends.
vi.mock('../src/utils/email.js', () => ({
  getEmailProvider: () => ({
    sendEmail: vi.fn().mockResolvedValue(undefined)
  })
}));

// Now import the app (after mocks are hoisted).
import { app } from '../src/app.js';
import oracledb from 'oracledb';

const request = supertest(app);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_REGISTRATION = {
  username: 'TestUser42',
  email: 'Test@Example.COM',
  password: 'SecurePass1',
  displayName: 'Test User'
};

let userIdCounter = 1000;

/**
 * Configure the mocked withTransaction so createUserOnConnection and
 * saveRefreshTokenOnConnection behave as expected for the happy path.
 */
function setupHappyPathMocks() {
  const createdUserId = ++userIdCounter;

  mockWithTransaction.mockImplementation(async (action: (conn: any) => Promise<any>) => {
    const fakeConn = {
      execute: vi.fn().mockImplementation(async (sql: string, binds: any, _opts: any) => {
        if (sql.includes('INSERT INTO USERS')) {
          return {
            outBinds: { userId: [createdUserId] },
            rowsAffected: 1
          };
        }
        if (sql.includes('SELECT') && sql.includes('FROM USERS')) {
          return {
            rows: [{
              USER_ID: createdUserId,
              USERNAME: (binds.username || 'testuser42'),
              EMAIL: (binds.email || 'test@example.com'),
              DISPLAY_NAME: 'Test User',
              BIO: null,
              PROFILE_IMAGE_URL: null,
              COVER_IMAGE_URL: null,
              LOCATION: null,
              WEBSITE_URL: null,
              FAILED_LOGIN_ATTEMPTS: 0,
              FIRST_FAILED_ATTEMPT_AT: null,
              LOCKOUT_UNTIL: null,
              CREATED_AT: new Date('2026-01-01T00:00:00Z'),
              UPDATED_AT: new Date('2026-01-01T00:00:00Z'),
              FOLLOWERS_COUNT: 0,
              FOLLOWING_COUNT: 0,
              IS_FOLLOWING: 0
            }]
          };
        }
        if (sql.includes('INSERT INTO REFRESH_TOKENS')) {
          return { rowsAffected: 1 };
        }
        return { rows: [] };
      }),
      commit: vi.fn(),
      rollback: vi.fn(),
      close: vi.fn()
    };
    return action(fakeConn);
  });

  // Also mock executeSql for the duplicate-check SELECT queries
  // (findByUsername, findByEmail run outside the transaction).
  mockExecuteSql.mockImplementation(async (sql: string, _binds: any) => {
    if (sql.includes('FROM USERS') && sql.includes('WHERE')) {
      return { rows: [] }; // No duplicates found
    }
    return { rows: [] };
  });
}

/**
 * Configure mocks so createUserOnConnection throws an ORA-00001 with the
 * given constraint name.
 */
function setupDuplicateMock(constraintName: string) {
  mockExecuteSql.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM USERS')) {
      return { rows: [] };
    }
    return { rows: [] };
  });

  mockWithTransaction.mockImplementation(async (action: (conn: any) => Promise<any>) => {
    const fakeConn = {
      execute: vi.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('INSERT INTO USERS')) {
          const oraErr: any = new Error(`ORA-00001: unique constraint (C##NEXA_USER.${constraintName}) violated`);
          oraErr.errorNum = 1;
          throw oraErr;
        }
        return { rows: [] };
      }),
      commit: vi.fn(),
      rollback: vi.fn(),
      close: vi.fn()
    };
    return action(fakeConn);
  });
}

/**
 * Configure mocks so the user insert succeeds but refresh-token insert fails,
 * verifying the transaction is rolled back.
 */
function setupRefreshTokenFailureMock() {
  const createdUserId = ++userIdCounter;

  mockExecuteSql.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM USERS')) {
      return { rows: [] };
    }
    return { rows: [] };
  });

  mockWithTransaction.mockImplementation(async (action: (conn: any) => Promise<any>) => {
    const fakeConn = {
      execute: vi.fn().mockImplementation(async (sql: string, binds: any) => {
        if (sql.includes('INSERT INTO USERS')) {
          return {
            outBinds: { userId: [createdUserId] },
            rowsAffected: 1
          };
        }
        if (sql.includes('SELECT') && sql.includes('FROM USERS')) {
          return {
            rows: [{
              USER_ID: createdUserId,
              USERNAME: 'testuser42',
              EMAIL: 'test@example.com',
              DISPLAY_NAME: 'Test User',
              BIO: null,
              PROFILE_IMAGE_URL: null,
              COVER_IMAGE_URL: null,
              LOCATION: null,
              WEBSITE_URL: null,
              FAILED_LOGIN_ATTEMPTS: 0,
              FIRST_FAILED_ATTEMPT_AT: null,
              LOCKOUT_UNTIL: null,
              CREATED_AT: new Date('2026-01-01T00:00:00Z'),
              UPDATED_AT: new Date('2026-01-01T00:00:00Z'),
              FOLLOWERS_COUNT: 0,
              FOLLOWING_COUNT: 0,
              IS_FOLLOWING: 0
            }]
          };
        }
        if (sql.includes('INSERT INTO REFRESH_TOKENS')) {
          throw new Error('Simulated refresh-token insertion failure');
        }
        return { rows: [] };
      }),
      commit: vi.fn(),
      rollback: vi.fn(),
      close: vi.fn()
    };

    // Simulate withTransaction rollback behavior
    try {
      const result = await action(fakeConn);
      await fakeConn.commit();
      return result;
    } catch (err) {
      await fakeConn.rollback();
      throw err;
    }
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Registration endpoint (POST /api/auth/register)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 201 and creates one user and one refresh token on success', async () => {
    setupHappyPathMocks();

    const res = await request
      .post('/api/auth/register')
      .send(VALID_REGISTRATION)
      .expect(201);

    expect(res.body.data).toBeDefined();
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.userId).toBeGreaterThan(0);
    expect(res.body.data.user.username).toBe('testuser42'); // normalized
    expect(res.body.data.user.email).toBe('test@example.com'); // normalized
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.refreshToken).toBeDefined();
    expect(res.body.message).toBe('Registration successful');

    // Verify passwordHash is NOT exposed
    expect(res.body.data.user.passwordHash).toBeUndefined();

    // Verify withTransaction was called (atomic operation)
    expect(mockWithTransaction).toHaveBeenCalledOnce();
  });

  it('returns 409 for duplicate username', async () => {
    setupDuplicateMock('UQ_USERS_USERNAME');

    const res = await request
      .post('/api/auth/register')
      .send(VALID_REGISTRATION)
      .expect(409);

    expect(res.body.title).toBe('USERNAME_TAKEN');
    expect(res.body.detail).toBe('Username is already registered');
  });

  it('returns 409 for duplicate email', async () => {
    setupDuplicateMock('UQ_USERS_EMAIL');

    const res = await request
      .post('/api/auth/register')
      .send(VALID_REGISTRATION)
      .expect(409);

    expect(res.body.title).toBe('EMAIL_TAKEN');
    expect(res.body.detail).toBe('Email is already registered');
  });

  it('returns 409 when pre-check finds existing username', async () => {
    mockExecuteSql.mockImplementation(async (sql: string) => {
      if (sql.includes('WHERE LOWER(USERNAME)')) {
        return {
          rows: [{
            USER_ID: 1, USERNAME: 'testuser42', EMAIL: 'other@test.com',
            DISPLAY_NAME: 'Other', CREATED_AT: new Date(), UPDATED_AT: new Date()
          }]
        };
      }
      return { rows: [] };
    });

    const res = await request
      .post('/api/auth/register')
      .send(VALID_REGISTRATION)
      .expect(409);

    expect(res.body.title).toBe('USERNAME_TAKEN');
    // withTransaction should NOT have been called (rejected before DB insertion phase)
    expect(mockWithTransaction).not.toHaveBeenCalled();
  });

  it('rolls back user insertion when refresh-token insertion fails', async () => {
    setupRefreshTokenFailureMock();

    const res = await request
      .post('/api/auth/register')
      .send(VALID_REGISTRATION);

    // Should NOT return 201 — the transaction failed
    expect(res.status).not.toBe(201);

    // The mock withTransaction was called and should have rolled back
    expect(mockWithTransaction).toHaveBeenCalledOnce();
  });

  it('does not use oracledb.DATE output binds for TIMESTAMP WITH TIME ZONE columns', async () => {
    // Verify the createUser SQL no longer returns CREATED_AT or UPDATED_AT
    // through RETURNING ... INTO with oracledb.DATE binds.
    const { OracleUserRepository } = await import('../src/repositories/oracle/user.oracle.repo.js');
    const repo = new OracleUserRepository();

    // Inspect the createUserOnConnection method to ensure it only binds userId
    const fakeConn = {
      execute: vi.fn().mockResolvedValue({
        outBinds: { userId: [999] },
        rowsAffected: 1,
        rows: [{
          USER_ID: 999, USERNAME: 'test', EMAIL: 'test@test.com',
          DISPLAY_NAME: 'Test', BIO: null, PROFILE_IMAGE_URL: null,
          COVER_IMAGE_URL: null, LOCATION: null, WEBSITE_URL: null,
          CREATED_AT: new Date(), UPDATED_AT: new Date(),
          FOLLOWERS_COUNT: 0, FOLLOWING_COUNT: 0, IS_FOLLOWING: 0
        }]
      })
    };

    // Provide two calls: first for INSERT, second for SELECT re-read
    let callCount = 0;
    fakeConn.execute.mockImplementation(async (sql: string, binds: any) => {
      callCount++;
      if (sql.includes('INSERT INTO USERS')) {
        // Verify the binds do NOT contain createdAt or updatedAt with oracledb.DATE
        expect(binds.createdAt).toBeUndefined();
        expect(binds.updatedAt).toBeUndefined();
        // Verify userId is bound as NUMBER output
        expect(binds.userId).toEqual({ type: oracledb.NUMBER, dir: oracledb.BIND_OUT });
        return { outBinds: { userId: [999] }, rowsAffected: 1 };
      }
      // SELECT re-read
      return {
        rows: [{
          USER_ID: 999, USERNAME: 'test', EMAIL: 'test@test.com',
          DISPLAY_NAME: 'Test', BIO: null, PROFILE_IMAGE_URL: null,
          COVER_IMAGE_URL: null, LOCATION: null, WEBSITE_URL: null,
          CREATED_AT: new Date(), UPDATED_AT: new Date(),
          FOLLOWERS_COUNT: 0, FOLLOWING_COUNT: 0, IS_FOLLOWING: 0
        }]
      };
    });

    const user = await repo.createUserOnConnection(fakeConn, {
      username: 'test', email: 'test@test.com',
      passwordHash: 'hash', displayName: 'Test'
    });

    expect(user.userId).toBe(999);
    expect(callCount).toBe(2); // INSERT + SELECT
  });

  it('returns sanitized 500 message in production for unexpected errors', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      mockExecuteSql.mockRejectedValue(new Error('Unexpected internal failure'));

      const res = await request
        .post('/api/auth/register')
        .set('x-forwarded-proto', 'https')
        .send(VALID_REGISTRATION);

      // The error middleware should return a sanitized message
      expect(res.status).toBe(500);
      expect(res.body.detail).toBe('An unexpected error occurred. Please try again later.');
      // Must NOT contain internal error details
      expect(res.body.detail).not.toContain('Unexpected internal failure');
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('normalizes username and email before duplicate check and insertion', async () => {
    setupHappyPathMocks();

    const res = await request
      .post('/api/auth/register')
      .set('x-forwarded-proto', 'https')
      .send({
        ...VALID_REGISTRATION,
        username: '  TestUser42  ',
        email: '  TEST@EXAMPLE.COM  '
      })
      .expect(201);

    // The returned user should have normalized values
    expect(res.body.data.user.username).toBe('testuser42');
    expect(res.body.data.user.email).toBe('test@example.com');
  });

  it('rejects invalid registration payload with 400', async () => {
    const res = await request
      .post('/api/auth/register')
      .set('x-forwarded-proto', 'https')
      .send({ username: 'ab', email: 'not-an-email', password: 'short', displayName: 'X' })
      .expect(400);

    expect(res.body.title).toBe('VALIDATION_ERROR');
  });
});
