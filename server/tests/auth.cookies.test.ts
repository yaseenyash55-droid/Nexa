import { describe, expect, it, vi } from 'vitest';
import supertest from 'supertest';
import { app } from '../src/app.js';
import { getRefreshTokenCookieOptions, getClearRefreshTokenCookieOptions } from '../src/controllers/auth.controller.js';
import { AuthService } from '../src/services/auth.service.js';
import { signRefreshToken, signAccessToken } from '../src/utils/jwt.js';
import { hashToken } from '../src/utils/hash.js';
import * as poolModule from '../src/db/pool.js';

describe('Auth Cookies, Token Rotation, Replay Protection, and Logout', () => {
  const request = supertest(app);

  describe('Cookie Configuration and Attributes', () => {
    it('provides secure HttpOnly cookie attributes with path /', () => {
      const options = getRefreshTokenCookieOptions();
      expect(options.httpOnly).toBe(true);
      expect(options.path).toBe('/');
      expect(options.maxAge).toBeGreaterThan(0);
      expect(['lax', 'none']).toContain(options.sameSite);
    });

    it('provides matching cookie options when clearing the refresh token', () => {
      const clearOptions = getClearRefreshTokenCookieOptions();
      expect(clearOptions.httpOnly).toBe(true);
      expect(clearOptions.path).toBe('/');
      expect(['lax', 'none']).toContain(clearOptions.sameSite);
    });
  });

  describe('Token Refresh Rotation & Replay Rejection Logic', () => {
    it('rotates refresh token and revokes the previous token', async () => {
      const authService = new AuthService();
      const mockUser = {
        userId: 999,
        username: 'testrotator',
        email: 'testrotator@nexa.app',
        displayName: 'Test Rotator',
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const initialRefreshToken = signRefreshToken({
        userId: mockUser.userId,
        username: mockUser.username,
        email: mockUser.email
      });

      const initialHash = hashToken(initialRefreshToken);
      let storedTokenRecord: any = {
        userId: mockUser.userId,
        tokenHash: initialHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revokedAt: null
      };

      // Mock repository methods
      const authRepoMock = (authService as any).authRepo;
      vi.spyOn(authRepoMock, 'findRefreshToken').mockImplementation(async (hash: string) => {
        if (storedTokenRecord && storedTokenRecord.tokenHash === hash) {
          return storedTokenRecord;
        }
        return null;
      });

      vi.spyOn(authRepoMock, 'revokeRefreshToken').mockImplementation(async (hash: string) => {
        if (storedTokenRecord && storedTokenRecord.tokenHash === hash) {
          storedTokenRecord.revokedAt = new Date();
        }
      });

      vi.spyOn(authRepoMock, 'saveRefreshToken').mockImplementation(async (userId: number, hash: string, expiresAt: Date) => {
        storedTokenRecord = {
          userId,
          tokenHash: hash,
          expiresAt,
          revokedAt: null
        };
      });

      const userRepoMock = (authService as any).userRepo;
      vi.spyOn(userRepoMock, 'findById').mockResolvedValue(mockUser);

      // First refresh: should succeed and rotate
      const refreshResult = await authService.refreshTokens(initialRefreshToken);
      expect(refreshResult.accessToken).toBeDefined();
      expect(refreshResult.newRefreshToken).toBeDefined();
      expect(refreshResult.newRefreshToken).not.toBe(initialRefreshToken);

      // Second refresh with initial (already rotated/revoked) token: should fail (replay rejection)
      await expect(authService.refreshTokens(initialRefreshToken)).rejects.toMatchObject({
        statusCode: 401,
        code: 'INVALID_REFRESH_TOKEN'
      });
    });

    it('revokes exact refresh token on server logout', async () => {
      const authService = new AuthService();
      const testToken = signRefreshToken({ userId: 50, username: 'logoutuser' });
      const testHash = hashToken(testToken);

      const authRepoMock = (authService as any).authRepo;
      const revokeSpy = vi.spyOn(authRepoMock, 'revokeRefreshToken').mockResolvedValue(undefined);

      await authService.logout(testToken);
      expect(revokeSpy).toHaveBeenCalledWith(testHash);
    });
  });

  describe('CORS and Origin Protection', () => {
    it('accepts requests from allowed client origins', async () => {
      const response = await request
        .options('/api/auth/refresh')
        .set('Origin', 'https://nexa-social-app.surge.sh')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.headers['access-control-allow-origin']).toBe('https://nexa-social-app.surge.sh');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('does not allow arbitrary malicious origins', async () => {
      const response = await request
        .options('/api/auth/refresh')
        .set('Origin', 'https://evil-attacker-site.com')
        .set('Access-Control-Request-Method', 'POST');

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
