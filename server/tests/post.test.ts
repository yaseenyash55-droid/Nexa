import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { app } from '../src/app.js';

process.env.DATA_SOURCE = 'mock';

describe('Posts, Feeds, Likes, Comments & Bookmarks API', () => {
  const request = supertest(app);
  let alexToken: string;
  let alexUserId: number;

  let createdPostId: number;
  let createdCommentId: number;

  beforeAll(async () => {
    const loginRes = await request.post('/api/auth/login').send({
      emailOrUsername: 'alex',
      password: 'Password123!'
    });
    alexToken = loginRes.body.data.accessToken;
    alexUserId = loginRes.body.data.user.userId;
  });

  it('should reject post creation with empty content and no image', async () => {
    const res = await request
      .post('/api/posts/create')
      .set('Authorization', `Bearer ${alexToken}`)
      .send({
        content: '   ',
        imageUrl: '   '
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should create a valid text-only post', async () => {
    const res = await request
      .post('/api/posts/create')
      .set('Authorization', `Bearer ${alexToken}`)
      .send({
        content: 'Testing Stage 6 text-only post creation!'
      });

    expect(res.status).toBe(201);
    expect(res.body.data.content).toBe('Testing Stage 6 text-only post creation!');
    expect(res.body.data.author.username).toBe('alex');
    createdPostId = res.body.data.postId;
  });

  it('should create a valid image-only post', async () => {
    const res = await request
      .post('/api/posts/create')
      .set('Authorization', `Bearer ${alexToken}`)
      .send({
        imageUrl: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=1000&q=80'
      });

    expect(res.status).toBe(201);
    expect(res.body.data.imageUrl).toBeDefined();
  });

  it('should fetch global feed with pagination cursor metadata', async () => {
    const res = await request
      .get('/api/posts/feed?scope=global&limit=5')
      .set('Authorization', `Bearer ${alexToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toHaveProperty('hasMore');
  });

  it('should fetch following feed for authenticated user', async () => {
    const res = await request
      .get('/api/posts/feed?scope=following&limit=5')
      .set('Authorization', `Bearer ${alexToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should like and unlike post idempotently', async () => {
    // Like post
    const like1 = await request
      .post(`/api/posts/${createdPostId}/like`)
      .set('Authorization', `Bearer ${alexToken}`);
    expect(like1.status).toBe(200);

    // Duplicate like (idempotent)
    const like2 = await request
      .post(`/api/posts/${createdPostId}/like`)
      .set('Authorization', `Bearer ${alexToken}`);
    expect(like2.status).toBe(200);

    // Unlike post
    const unlike = await request
      .delete(`/api/posts/${createdPostId}/like`)
      .set('Authorization', `Bearer ${alexToken}`);
    expect(unlike.status).toBe(200);
  });

  it('should bookmark and unbookmark post idempotently', async () => {
    // Bookmark post
    const bm1 = await request
      .post(`/api/posts/${createdPostId}/bookmark`)
      .set('Authorization', `Bearer ${alexToken}`);
    expect(bm1.status).toBe(200);

    // Fetch bookmarks
    const getBm = await request
      .get('/api/posts/bookmarks')
      .set('Authorization', `Bearer ${alexToken}`);
    expect(getBm.status).toBe(200);
    expect(getBm.body.data.some((p: any) => p.postId === createdPostId)).toBe(true);

    // Unbookmark
    const bm2 = await request
      .delete(`/api/posts/${createdPostId}/bookmark`)
      .set('Authorization', `Bearer ${alexToken}`);
    expect(bm2.status).toBe(200);
  });

  it('should add comment to post and list comments', async () => {
    const addRes = await request
      .post(`/api/posts/${createdPostId}/comment`)
      .set('Authorization', `Bearer ${alexToken}`)
      .send({
        content: 'This is a test comment on the post.'
      });

    expect(addRes.status).toBe(201);
    expect(addRes.body.data.content).toBe('This is a test comment on the post.');
    createdCommentId = addRes.body.data.commentId;

    const listRes = await request.get(`/api/posts/${createdPostId}/comments`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some((c: any) => c.commentId === createdCommentId)).toBe(true);
  });

  it('should delete comment as owner', async () => {
    const delRes = await request
      .delete(`/api/posts/${createdPostId}/comments/${createdCommentId}`)
      .set('Authorization', `Bearer ${alexToken}`);

    expect(delRes.status).toBe(200);
  });

  it('should delete post as owner', async () => {
    const delRes = await request
      .delete(`/api/posts/${createdPostId}`)
      .set('Authorization', `Bearer ${alexToken}`);

    expect(delRes.status).toBe(200);
  });
});
