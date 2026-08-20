import { describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { app } from '../src/app.js';
import {
  validateProductionConnectString,
  getRequiredEnv,
  getPositiveInteger
} from '../src/config/env.js';

describe('Oracle Configuration and Production Environment Security', () => {
  const request = supertest(app);

  describe('Production Localhost & Loopback Rejection', () => {
    it('rejects localhost connect string in production mode', () => {
      expect(() => {
        validateProductionConnectString('localhost:1521/FREEPDB1', true);
      }).toThrow(/Production DB_CONNECT_STRING targets local loopback/);
    });

    it('rejects 127.0.0.1 connect string in production mode', () => {
      expect(() => {
        validateProductionConnectString('127.0.0.1:1521/XEPDB1', true);
      }).toThrow(/Production DB_CONNECT_STRING targets local loopback/);
    });

    it('rejects 0.0.0.0 connect string in production mode', () => {
      expect(() => {
        validateProductionConnectString('0.0.0.0:1521/ORCLPDB', true);
      }).toThrow(/Production DB_CONNECT_STRING targets local loopback/);
    });

    it('rejects ::1 IPv6 loopback connect string in production mode', () => {
      expect(() => {
        validateProductionConnectString('[::1]:1521/ORCLPDB', true);
      }).toThrow(/Production DB_CONNECT_STRING targets local loopback/);
    });

    it('allows localhost in development mode', () => {
      expect(() => {
        validateProductionConnectString('localhost:1521/FREEPDB1', false);
      }).not.toThrow();
    });

    it('accepts remote hosted Oracle cloud / TCPS connect strings in production', () => {
      expect(() => {
        validateProductionConnectString(
          'tcps://adb.us-ashburn-1.oraclecloud.com:1522/g89b_nexa_high.adb.oraclecloud.com?wallet_location=/etc/oracle/wallet',
          true
        );
      }).not.toThrow();

      expect(() => {
        validateProductionConnectString(
          '(DESCRIPTION=(ADDRESS=(PROTOCOL=tcps)(PORT=1522)(HOST=db.example.com))(CONNECT_DATA=(SERVICE_NAME=prod_svc)))',
          true
        );
      }).not.toThrow();
    });
  });

  describe('Required Environment Variable Validation', () => {
    it('throws fatal configuration error when required variable is missing in production', () => {
      expect(() => {
        getRequiredEnv(['NON_EXISTENT_VAR_1', 'NON_EXISTENT_VAR_2'], 'TEST_VAR', true);
      }).toThrow(/Missing required environment variable: TEST_VAR/);
    });

    it('returns empty string when optional/development variable is missing', () => {
      const val = getRequiredEnv(['NON_EXISTENT_VAR_1'], 'TEST_VAR', false);
      expect(val).toBe('');
    });

    it('resolves alias keys in priority order', () => {
      process.env.TEST_PRIMARY_KEY = 'primary_val';
      process.env.TEST_SECONDARY_KEY = 'secondary_val';

      const resolved = getRequiredEnv(['TEST_PRIMARY_KEY', 'TEST_SECONDARY_KEY'], 'TEST', true);
      expect(resolved).toBe('primary_val');

      delete process.env.TEST_PRIMARY_KEY;
      delete process.env.TEST_SECONDARY_KEY;
    });

    it('validates positive integers properly', () => {
      process.env.TEST_INT = '10';
      expect(getPositiveInteger('TEST_INT', 5)).toBe(10);

      process.env.TEST_INT = '-5';
      expect(() => getPositiveInteger('TEST_INT', 5)).toThrow(/must be a positive integer/);

      delete process.env.TEST_INT;
    });
  });

  describe('Sanitized Health Responses (No Information Leakage)', () => {
    it('returns sanitized 503 response when pool is uninitialized/unreachable', async () => {
      const response = await request.get('/api/health');

      expect(response.status).toBe(503);
      expect(response.body.data.status).toBe('degraded');
      expect(response.body.data.mode).toBe('oracle');
      expect(response.body.data.database.reachable).toBe(false);
      expect(response.body.data.database.details).toBe('Database unreachable');

      // Ensure no internal errors, credentials, hosts or ports are exposed
      const bodyStr = JSON.stringify(response.body);
      expect(bodyStr).not.toContain('localhost');
      expect(bodyStr).not.toContain('127.0.0.1');
      expect(bodyStr).not.toContain('1521');
      expect(bodyStr).not.toContain('ORA-');
      expect(bodyStr).not.toContain('NJS-');
      expect(bodyStr).not.toContain('FREEPDB1');
      expect(bodyStr).not.toContain('password');
    });

    it('returns sanitized readiness probe without stack trace', async () => {
      const response = await request.get('/api/health/ready');

      expect(response.status).toBe(503);
      expect(response.body.data.status).toBe('unready');
      expect(response.body.data.database).toBe('unreachable');
      expect(response.body.stack).toBeUndefined();
    });
  });
});
