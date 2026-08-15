import { describe, it, expect } from 'vitest';
import supertest from 'supertest';
import { app } from '../src/app.js';

process.env.DATA_SOURCE = 'mock';

describe('Auth & Session Integration API', () => {
  const request = supertest(app);

  it('should return health status with sanitized data mode', async () => {
    const res = await request.get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data.mode).toBeDefined();
    expect(res.body.data.database.reachable).toBe(true);
  });

  it('should register a new user with lowercase normalization', async () => {
    const timestamp = Date.now();
    const rawUsername = `TestUser_${timestamp}`;
    const rawEmail = `TEST_${timestamp}@NEXA.APP`;

    const res = await request.post('/api/auth/register').send({
      username: rawUsername,
      email: rawEmail,
      password: 'Password123!',
      displayName: 'Test User'
    });

    expect(res.status).toBe(201);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.username).toBe(rawUsername.toLowerCase());
    expect(res.body.data.user.email).toBe(rawEmail.toLowerCase());
  });

  it('should reject registration with duplicate username', async () => {
    const res = await request.post('/api/auth/register').send({
      username: 'alex',
      email: 'alex_unique@nexa.app',
      password: 'Password123!',
      displayName: 'Alex Duplicate'
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('USERNAME_TAKEN');
  });

  it('should reject registration with weak password', async () => {
    const res = await request.post('/api/auth/register').send({
      username: 'weak_user',
      email: 'weak@nexa.app',
      password: '123',
      displayName: 'Weak User'
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should return generic error for invalid username or password', async () => {
    const res1 = await request.post('/api/auth/login').send({
      emailOrUsername: 'non_existent_user',
      password: 'Password123!'
    });
    expect(res1.status).toBe(401);
    expect(res1.body.error.code).toBe('INVALID_CREDENTIALS');

    const res2 = await request.post('/api/auth/login').send({
      emailOrUsername: 'alex',
      password: 'WrongPassword123!'
    });
    expect(res2.status).toBe(401);
    expect(res2.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('should login successfully with valid credentials and return refresh token cookie', async () => {
    const res = await request.post('/api/auth/login').send({
      emailOrUsername: 'alex',
      password: 'Password123!'
    });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toContain('nexa_refresh_token');
  });

  it('should reject unauthenticated request to /api/auth/me', async () => {
    const res = await request.get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should return current user for valid bearer token', async () => {
    const loginRes = await request.post('/api/auth/login').send({
      emailOrUsername: 'alex',
      password: 'Password123!'
    });

    const token = loginRes.body.data.accessToken;

    const meRes = await request
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.username).toBe('alex');
  });
});
