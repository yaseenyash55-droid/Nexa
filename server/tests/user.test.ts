import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { app } from '../src/app.js';

process.env.DATA_SOURCE = 'mock';

describe('Users, Social Graph & Discovery API', () => {
  const request = supertest(app);
  let alexToken: string;
  let alexUserId: number;

  beforeAll(async () => {
    const loginRes = await request.post('/api/auth/login').send({
      emailOrUsername: 'alex',
      password: 'Password123!'
    });
    alexToken = loginRes.body.data.accessToken;
    alexUserId = loginRes.body.data.user.userId;
  });

  it('should fetch user profile by username', async () => {
    const res = await request.get('/api/users/username/alex');
    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe('alex');
    expect(res.body.data.displayName).toBe('Alex Rivera');
    expect(res.body.data.followersCount).toBeDefined();
    expect(res.body.data).not.toHaveProperty('passwordHash');
    expect(res.body.data).not.toHaveProperty('email');
  });

  it('should return 404 for non-existent profile', async () => {
    const res = await request.get('/api/users/username/non_existent_handle_99');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('USER_NOT_FOUND');
  });

  it('should update profile as owner', async () => {
    const res = await request
      .put(`/api/users/${alexUserId}`)
      .set('Authorization', `Bearer ${alexToken}`)
      .send({
        displayName: 'Alex Rivera Updated',
        bio: 'Updated bio for testing',
        location: 'San Francisco, CA'
      });

    expect(res.status).toBe(200);
    expect(res.body.data.displayName).toBe('Alex Rivera Updated');
    expect(res.body.data.bio).toBe('Updated bio for testing');
  });

  it('should reject profile update by non-owner', async () => {
    const res = await request
      .put('/api/users/999')
      .set('Authorization', `Bearer ${alexToken}`)
      .send({
        displayName: 'Hacked Name'
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('should reject self-following', async () => {
    const res = await request
      .post(`/api/users/${alexUserId}/follow`)
      .set('Authorization', `Bearer ${alexToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('CANNOT_FOLLOW_SELF');
  });

  it('should follow and unfollow user idempotently', async () => {
    // Follow user 2 (sarah_design)
    const followRes1 = await request
      .post('/api/users/2/follow')
      .set('Authorization', `Bearer ${alexToken}`);
    expect(followRes1.status).toBe(200);

    // Duplicate follow (idempotent)
    const followRes2 = await request
      .post('/api/users/2/follow')
      .set('Authorization', `Bearer ${alexToken}`);
    expect(followRes2.status).toBe(200);

    // Unfollow user 2
    const unfollowRes = await request
      .delete('/api/users/2/follow')
      .set('Authorization', `Bearer ${alexToken}`);
    expect(unfollowRes.status).toBe(200);
  });

  it('should search users by query', async () => {
    const res = await request.get('/api/users/search?q=sarah');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].username).toBe('sarah_design');
    expect(res.body.data[0]).not.toHaveProperty('passwordHash');
    expect(res.body.data[0]).not.toHaveProperty('email');
  });

  it('should get user suggestions excluding current user', async () => {
    const res = await request
      .get('/api/users/suggestions')
      .set('Authorization', `Bearer ${alexToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some((u: any) => u.userId === alexUserId)).toBe(false);
  });
});
