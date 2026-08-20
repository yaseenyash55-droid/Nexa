import { describe, expect, it, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { app } from '../src/app.js';
import { signAccessToken } from '../src/utils/jwt.js';
import { oraclePrivacyRepo } from '../src/repositories/oracle/privacy.oracle.repo.js';
import { PrivacyService } from '../src/services/privacy.service.js';

describe('Privacy, Moderation, Blocks, and Reports Suite', () => {
  const request = supertest(app);
  const testUserToken = signAccessToken({ userId: 101, username: 'testuser', email: 'test@nexa.app' });
  const moderatorToken = signAccessToken({ userId: 999, username: 'moduser', email: 'mod@nexa.app' });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Privacy Settings API', () => {
    it('fetches privacy settings from Oracle repository', async () => {
      const mockSettings = {
        userId: 101,
        isPrivate: true,
        whoCanMessage: 'FOLLOWING' as const,
        whoCanComment: 'FOLLOWING' as const,
        activityStatusVisible: false,
        readReceiptsEnabled: true,
        hideLikeCounts: true,
        updatedAt: new Date().toISOString()
      };

      vi.spyOn(oraclePrivacyRepo, 'getPrivacySettings').mockResolvedValueOnce(mockSettings);

      const response = await request
        .get('/api/privacy/settings')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.isPrivate).toBe(true);
      expect(response.body.data.whoCanMessage).toBe('FOLLOWING');
      expect(response.body.data.hideLikeCounts).toBe(true);
    });

    it('rejects invalid privacy settings payload with 400', async () => {
      const response = await request
        .put('/api/privacy/settings')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ whoCanMessage: 'INVALID_OPTION' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('updates privacy settings and returns updated record', async () => {
      const updatedMock = {
        userId: 101,
        isPrivate: true,
        whoCanMessage: 'NOBODY' as const,
        whoCanComment: 'EVERYONE' as const,
        activityStatusVisible: true,
        readReceiptsEnabled: false,
        hideLikeCounts: true,
        updatedAt: new Date().toISOString()
      };

      vi.spyOn(oraclePrivacyRepo, 'updatePrivacySettings').mockResolvedValueOnce(updatedMock);

      const response = await request
        .put('/api/privacy/settings')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ isPrivate: true, whoCanMessage: 'NOBODY', readReceiptsEnabled: false });

      expect(response.status).toBe(200);
      expect(response.body.data.whoCanMessage).toBe('NOBODY');
      expect(response.body.data.readReceiptsEnabled).toBe(false);
    });
  });

  describe('Hidden Words API', () => {
    it('retrieves and sanitizes user hidden words', async () => {
      vi.spyOn(oraclePrivacyRepo, 'getHiddenWords').mockResolvedValueOnce(['scam', 'crypto']);

      const response = await request
        .get('/api/privacy/hidden-words')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(['scam', 'crypto']);
    });

    it('rejects non-array hidden words payload', async () => {
      const response = await request
        .put('/api/privacy/hidden-words')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ words: 'not-an-array' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('persists cleaned words list', async () => {
      vi.spyOn(oraclePrivacyRepo, 'setHiddenWords').mockResolvedValueOnce(['spam', 'bot']);

      const response = await request
        .put('/api/privacy/hidden-words')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({ words: ['  SPAM  ', 'bot', ''] });

      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(['spam', 'bot']);
    });
  });

  describe('User Blocks API', () => {
    it('rejects self-blocking', async () => {
      const response = await request
        .post('/api/privacy/users/101/block')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('SELF_BLOCK_FORBIDDEN');
    });

    it('successfully unblocks user', async () => {
      vi.spyOn(oraclePrivacyRepo, 'unblockUser').mockResolvedValueOnce(undefined);

      const response = await request
        .delete('/api/privacy/users/202/block')
        .set('Authorization', `Bearer ${testUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.data.unblocked).toBe(true);
      expect(response.body.data.targetUserId).toBe(202);
    });
  });

  describe('Reports & Moderation Validation', () => {
    it('rejects reports with invalid targetType or short reasons', async () => {
      const response = await request
        .post('/api/privacy/reports')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          targetType: 'INVALID_TYPE',
          targetId: 5,
          reason: 'A'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('submits valid report and returns 201 with reportId', async () => {
      vi.spyOn(oraclePrivacyRepo, 'createReport').mockResolvedValueOnce({
        reportId: 55,
        status: 'PENDING'
      });

      const response = await request
        .post('/api/privacy/reports')
        .set('Authorization', `Bearer ${testUserToken}`)
        .send({
          targetType: 'POST',
          targetId: 12,
          reason: 'Spam content',
          details: 'Repeated promotional links'
        });

      expect(response.status).toBe(201);
      expect(response.body.data.submitted).toBe(true);
      expect(response.body.data.reportId).toBe(55);
    });

    it('enforces moderator/admin authorization for viewing report queue', async () => {
      const service = new PrivacyService();
      // Standard user role should be rejected
      await expect(service.getReports('USER')).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN'
      });

      // Null or undefined role should be rejected
      await expect(service.getReports(undefined)).rejects.toMatchObject({
        statusCode: 403,
        code: 'FORBIDDEN'
      });
    });
  });
});
