import { describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { app } from '../src/app.js';

describe('Security and Oracle-only architecture', () => {
  const request = supertest(app);

  it('returns the Oracle repository manager unconditionally', async () => {
    const { getRepositoryManager } = await import('../src/repositories/index.js');
    const { oracleRepositoryManager } = await import('../src/repositories/oracle/oracle.repo.js');

    expect(getRepositoryManager()).toBe(oracleRepositoryManager);
  });

  it('reports degraded health when the Oracle pool is not initialized', async () => {
    const response = await request.get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body.data.status).toBe('degraded');
    expect(response.body.data.mode).toBe('oracle');
    expect(response.body.data.database.reachable).toBe(false);
  });

  it('sets deployment security headers on degraded responses', async () => {
    const response = await request.get('/api/health');

    expect(response.headers['strict-transport-security']).toBeDefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });

  it('rejects malformed bearer tokens before data access', async () => {
    const response = await request.get('/api/auth/me').set('Authorization', 'Bearer invalid.jwt.token.string');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('blocks automated scraping user agents', async () => {
    const response = await request.get('/api/health').set('User-Agent', 'Scrapy/2.5.0 (+https://scrapy.org)');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('BOT_ACCESS_DENIED');
  });

  it('rejects spoofed image signatures', async () => {
    const { validateMagicBytes } = await import('../src/services/media.service.js');
    const scriptBytes = Buffer.from('<script>alert("XSS")</script>');

    expect(validateMagicBytes(scriptBytes, 'image/jpeg')).toBe(false);
    expect(validateMagicBytes(scriptBytes, 'image/png')).toBe(false);
  });

  it('sanitizes path traversal file names', async () => {
    const path = await import('path');
    const safeName = path.basename('../../../../etc/passwd');

    expect(safeName).toBe('passwd');
    expect(safeName).not.toContain('..');
  });

  it('rejects unauthenticated WebSocket handshakes', async () => {
    const { realtimeServer } = await import('../src/socket.js');

    expect(realtimeServer.authenticateHandshakeToken('invalid.token.string')).toBeNull();
  });

  it('hashes IP addresses before audit logging', async () => {
    const { hashIp, auditLogSecurityEvent } = await import('../src/utils/securityAuditLogger.js');
    const hashed = hashIp('192.168.1.50');

    expect(hashed).toHaveLength(16);
    expect(() => {
      auditLogSecurityEvent({
        eventType: 'AUTH_SUCCESS',
        userId: 101,
        username: 'alex',
        ip: '192.168.1.50'
      });
    }).not.toThrow();
  });

  it('removes script tags and dangerous event handlers', async () => {
    const { sanitizeInputString } = await import('../src/utils/sanitize.js');
    const sanitized = sanitizeInputString('<script>alert("XSS")</script><img src="x" onerror="alert(1)">Hello');

    expect(sanitized).not.toContain('<script>');
    expect(sanitized).not.toContain('onerror=');
    expect(sanitized).toBe('Hello');
  });
});
