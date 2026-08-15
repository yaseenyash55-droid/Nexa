import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { app } from '../src/app.js';

process.env.DATA_SOURCE = 'mock';

describe('Notifications & Product Polish API', () => {
  const request = supertest(app);
  let alexToken: string;

  beforeAll(async () => {
    const loginRes = await request.post('/api/auth/login').send({
      emailOrUsername: 'alex',
      password: 'Password123!'
    });
    alexToken = loginRes.body.data.accessToken;
  });

  it('should fetch user notifications list', async () => {
    const res = await request
      .get('/api/notifications')
      .set('Authorization', `Bearer ${alexToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should return unread notifications count', async () => {
    const res = await request
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${alexToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('unreadCount');
    expect(typeof res.body.data.unreadCount).toBe('number');
  });

  it('should mark all notifications as read idempotently', async () => {
    const res1 = await request
      .post('/api/notifications/read-all')
      .set('Authorization', `Bearer ${alexToken}`);

    expect(res1.status).toBe(200);

    const countRes = await request
      .get('/api/notifications/unread-count')
      .set('Authorization', `Bearer ${alexToken}`);

    expect(countRes.body.data.unreadCount).toBe(0);
  });

  it('should handle missing notifications gracefully with 404', async () => {
    const res = await request
      .patch('/api/notifications/99999/read')
      .set('Authorization', `Bearer ${alexToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOTIFICATION_NOT_FOUND');
  });
});
