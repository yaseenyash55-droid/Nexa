import { Router } from 'express';
import { env } from '../config/env.js';
import { checkOracleHealth } from '../db/pool.js';
import { sendSuccess } from '../utils/response.js';

const router = Router();

/**
 * Liveness Probe: GET /health
 * Fast process check for Kubernetes / PM2 liveness probe.
 * Does NOT perform DB queries or expose credentials.
 */
router.get('/', (_req, res) => {
  return sendSuccess(res, {
    status: 'ok',
    timestamp: new Date().toISOString()
  }, 'Process liveness check');
});

/**
 * Readiness Probe: GET /ready
 * Validates dependencies (Oracle DB connection pool, data source mode).
 * Returns HTTP 200 if ready to serve traffic, HTTP 503 if unready/degraded.
 * Omits connection strings, keys, or stack traces from payload.
 */
router.get('/ready', async (_req, res) => {
  if (env.DATA_SOURCE === 'mock') {
    return sendSuccess(res, {
      status: 'ready',
      mode: 'mock',
      timestamp: new Date().toISOString()
    }, 'Readiness check pass (mock mode)');
  }

  const dbHealth = await checkOracleHealth();
  const isReady = dbHealth.reachable;
  const statusCode = isReady ? 200 : 503;

  return sendSuccess(res, {
    status: isReady ? 'ready' : 'unready',
    database: isReady ? 'connected' : 'unreachable',
    timestamp: new Date().toISOString()
  }, 'Readiness check status', undefined, statusCode);
});

export default router;
