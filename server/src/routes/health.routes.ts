import { Router } from 'express';
import { checkOracleHealth } from '../db/pool.js';
import { sendSuccess } from '../utils/response.js';

const router = Router();

/**
 * Dependency health probe: GET /health
 * Confirms that the process and Oracle Database pool can serve requests.
 * Sanitized response: Never exposes credentials, connection strings, hosts, or raw database errors.
 */
router.get('/', async (_req, res) => {
  const dbHealth = await checkOracleHealth();
  const isHealthy = dbHealth.reachable;
  const statusCode = isHealthy ? 200 : 503;

  return sendSuccess(
    res,
    {
      status: isHealthy ? 'ok' : 'degraded',
      mode: 'oracle',
      database: {
        reachable: dbHealth.reachable,
        status: isHealthy ? 'connected' : 'unreachable',
        details: isHealthy ? 'Connected' : 'Database unreachable'
      },
      timestamp: new Date().toISOString()
    },
    isHealthy ? 'Process liveness check' : 'Database connection degraded',
    undefined,
    statusCode
  );
});

/**
 * Readiness Probe: GET /ready
 * Validates dependencies (Oracle DB connection pool, data source mode).
 * Returns HTTP 200 if ready to serve traffic, HTTP 503 if unready/degraded.
 * Omits connection strings, keys, or stack traces from payload.
 */
router.get('/ready', async (_req, res) => {
  const dbHealth = await checkOracleHealth();
  const isReady = dbHealth.reachable;
  const statusCode = isReady ? 200 : 503;

  return sendSuccess(
    res,
    {
      status: isReady ? 'ready' : 'unready',
      mode: 'oracle',
      database: {
        reachable: isReady,
        status: isReady ? 'connected' : 'unreachable',
        details: isReady ? 'Connected' : 'Database unreachable'
      },
      timestamp: new Date().toISOString()
    },
    'Readiness check status',
    undefined,
    statusCode
  );
});

export default router;
