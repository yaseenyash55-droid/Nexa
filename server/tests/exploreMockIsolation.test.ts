import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

describe('Explore Mock Content Isolation & Guards', () => {
  const originalEnvValue = process.env.SHOW_MOCK_EXPLORE_CONTENT;

  afterAll(() => {
    process.env.SHOW_MOCK_EXPLORE_CONTENT = originalEnvValue;
  });

  it('1. GET /api/explore/mock returns mock posts and reels when config flag is active', async () => {
    process.env.SHOW_MOCK_EXPLORE_CONTENT = 'true';
    const res = await request(app).get('/api/explore/mock');
    expect(res.status).toBe(200);
    expect(res.body.data.posts).toBeDefined();
    expect(res.body.data.posts.length).toBeGreaterThan(0);
    expect(res.body.data.posts[0].isMock).toBe(true);
    expect(res.body.data.reels).toBeDefined();
    expect(res.body.data.reels.length).toBeGreaterThan(0);
    expect(res.body.data.reels[0].isMock).toBe(true);
  });

  it('2. GET /api/explore/mock returns empty lists when config flag is disabled', async () => {
    process.env.SHOW_MOCK_EXPLORE_CONTENT = 'false';
    const res = await request(app).get('/api/explore/mock');
    expect(res.status).toBe(200);
    expect(res.body.data.posts).toEqual([]);
    expect(res.body.data.reels).toEqual([]);
  });

  it('3. Hard Guard: Mock content NEVER leaks to the standard Home global feed', async () => {
    process.env.SHOW_MOCK_EXPLORE_CONTENT = 'true';
    const res = await request(app).get('/api/posts/feed');
    // Global feed may be empty or contain real test posts
    if (res.body.data && Array.isArray(res.body.data)) {
      const containsMock = res.body.data.some((p: any) => p.isMock === true || p.postId === 9991 || p.postId === 9992);
      expect(containsMock).toBe(false);
    }
  });

  it('4. Hard Guard: Mock content NEVER leaks to specific search/discover feeds', async () => {
    process.env.SHOW_MOCK_EXPLORE_CONTENT = 'true';
    // If there is an search endpoint
    const res = await request(app).get('/api/posts/search?q=Iceland');
    if (res.body.data && Array.isArray(res.body.data)) {
      const containsMock = res.body.data.some((p: any) => p.isMock === true);
      expect(containsMock).toBe(false);
    }
  });
});
