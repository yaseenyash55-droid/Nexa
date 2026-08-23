import { Router } from 'express';
import { createHmac } from 'node:crypto';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { AuthenticatedRequest } from '../types/index.js';
import { sendSuccess } from '../utils/response.js';

export const callRouter = Router();

export function createShortLivedTurnCredentials(
  sharedSecret: string,
  userId: number,
  ttlSeconds: number,
  nowSeconds = Math.floor(Date.now() / 1000)
) {
  const username = `${nowSeconds + ttlSeconds}:${userId}`;
  return {
    username,
    credential: createHmac('sha1', sharedSecret).update(username).digest('base64')
  };
}

callRouter.get('/ice-config', requireAuth, (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (!env.WEBRTC_CALLING_ENABLED) {
    return sendSuccess(res, {
      enabled: false,
      iceServers: [],
      reason: env.WEBRTC_CALLING_REQUESTED
        ? 'TURN configuration is incomplete'
        : 'Calling is not enabled'
    });
  }

  const turnCredentials = env.WEBRTC_TURN_SHARED_SECRET
    ? createShortLivedTurnCredentials(
        env.WEBRTC_TURN_SHARED_SECRET,
        (req as AuthenticatedRequest).user!.userId,
        env.WEBRTC_TURN_CREDENTIAL_TTL_SECONDS
      )
    : {
        username: env.WEBRTC_TURN_USERNAME,
        credential: env.WEBRTC_TURN_CREDENTIAL
      };

  return sendSuccess(res, {
    enabled: true,
    iceServers: [
      ...(env.WEBRTC_STUN_URLS.length > 0
        ? [{ urls: env.WEBRTC_STUN_URLS }]
        : []),
      {
        urls: env.WEBRTC_TURN_URLS,
        ...turnCredentials
      }
    ]
  });
});
