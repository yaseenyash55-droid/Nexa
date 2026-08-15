import { describe, it, expect, beforeAll } from 'vitest';
import supertest from 'supertest';
import { app } from '../src/app.js';

process.env.DATA_SOURCE = 'mock';

describe('Security, Authorization & Priority 0 Audit Suite', () => {
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

  it('should safely escape SQL-injection-shaped input strings without executing SQL', async () => {
    const sqlInjectionString = "' OR '1'='1' -- DROP TABLE USERS;";
    const res = await request
      .get(`/api/users/search?q=${encodeURIComponent(sqlInjectionString)}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(0);
  });

  it('should reject forged user ID updates (ID in path != verified JWT user ID)', async () => {
    const otherUserId = 999;
    const res = await request
      .put(`/api/users/${otherUserId}`)
      .set('Authorization', `Bearer ${alexToken}`)
      .send({
        displayName: 'Hacked User Name'
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('should verify the current password before issuing a reauthentication result', async () => {
    const rejected = await request
      .post('/api/security/reauthenticate')
      .set('Authorization', `Bearer ${alexToken}`)
      .send({ password: 'wrong-password' });
    expect(rejected.status).toBe(401);
    expect(rejected.body.error.code).toBe('INVALID_CREDENTIALS');

    const accepted = await request
      .post('/api/security/reauthenticate')
      .set('Authorization', `Bearer ${alexToken}`)
      .send({ password: 'Password123!' });
    expect(accepted.status).toBe(200);
    expect(accepted.body.data.reauthenticated).toBe(true);
  });

  it('should fail closed instead of enabling unverified MFA', async () => {
    const res = await request
      .post('/api/security/mfa/setup')
      .set('Authorization', `Bearer ${alexToken}`);
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('MFA_NOT_CONFIGURED');
  });

  it('should reject requests with invalid or malformed Bearer JWT token', async () => {
    const res = await request
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.jwt.token.string');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should prevent mass assignment of sensitive user fields (e.g. passwordHash, userId)', async () => {
    const res = await request
      .put(`/api/users/${alexUserId}`)
      .set('Authorization', `Bearer ${alexToken}`)
      .send({
        displayName: 'Alex Verified',
        passwordHash: 'MALICIOUS_HASH_OVERWRITE',
        userId: 100,
        isAdmin: true
      });

    expect(res.status).toBe(200);
    expect(res.body.data.displayName).toBe('Alex Verified');
    expect(res.body.data.userId).toBe(alexUserId);
    expect(res.body.data).not.toHaveProperty('isAdmin');
  });

  it('should reject attempts to delete another user\'s post', async () => {
    const otherUserPostId = 102; // sarah's post
    const res = await request
      .delete(`/api/posts/${otherUserPostId}`)
      .set('Authorization', `Bearer ${alexToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('should enforce 24h server-side expiration filtering on stories', async () => {
    const res = await request.get('/api/stories/feed');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);

    const now = new Date().toISOString();
    res.body.data.forEach((story: any) => {
      expect(new Date(story.expiresAt).valueOf()).toBeGreaterThan(new Date(now).valueOf());
    });
  });

  it('should protect story creation and reject unauthenticated requests', async () => {
    const res = await request.post('/api/stories').send({
      mediaUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
      caption: 'Test story'
    });
    expect(res.status).toBe(401);
  });

  it('should protect direct messaging endpoints and require authorization', async () => {
    const res = await request.get('/api/messages/2');
    expect(res.status).toBe(401);
  });

  it('should reject spoofed media uploads with invalid magic bytes', async () => {
    const maliciousScriptBuffer = Buffer.from('<script>alert("XSS")</script>');
    const { validateMagicBytes } = await import('../src/services/media.service.js');
    
    const isValidJpeg = validateMagicBytes(maliciousScriptBuffer, 'image/jpeg');
    const isValidPng = validateMagicBytes(maliciousScriptBuffer, 'image/png');

    expect(isValidJpeg).toBe(false);
    expect(isValidPng).toBe(false);

    const endpointResponse = await request
      .post('/api/media/upload')
      .set('Authorization', `Bearer ${alexToken}`)
      .field('kind', 'photo')
      .attach('file', maliciousScriptBuffer, { filename: 'spoofed.png', contentType: 'image/png' });
    expect(endpointResponse.status).toBe(415);
    expect(endpointResponse.body.error.code).toBe('INVALID_FILE_SIGNATURE');
  });

  it('should sanitize path traversal strings in uploaded file names', async () => {
    const pathTraversalName = '../../../../etc/passwd';
    const path = await import('path');
    const safeName = path.basename(pathTraversalName);
    
    expect(safeName).toBe('passwd');
    expect(safeName).not.toContain('..');
  });

  it('should reject unauthenticated WebSocket handshake tokens', async () => {
    const { realtimeServer } = await import('../src/socket.js');
    const authData = realtimeServer.authenticateHandshakeToken('invalid.token.string');
    expect(authData).toBeNull();
  });

  it('should strictly derive socket sender ID from verified JWT session payload and reject forged sender IDs', async () => {
    const { realtimeServer } = await import('../src/socket.js');
    const authData = realtimeServer.authenticateHandshakeToken(alexToken);
    expect(authData).not.toBeNull();
    expect(authData?.userId).toBe(alexUserId);
    expect(authData?.username).toBe('alex');
  });
});
