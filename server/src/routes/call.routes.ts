import { Router } from 'express';
import { createHmac } from 'node:crypto';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { AuthenticatedRequest } from '../types/index.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { AccessToken } from 'livekit-server-sdk';

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

callRouter.post('/token', requireAuth, async (req, res) => {
  const { roomName } = req.body;
  if (!roomName) {
    return sendError(res, 400, 'Room name is required');
  }

  const user = (req as AuthenticatedRequest).user!;
  
  if (!env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET) {
    return sendError(res, 500, 'LiveKit credentials not configured');
  }

  try {
    const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
      identity: user.userId.toString(),
      name: user.displayName,
    });

    at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });

    const token = await at.toJwt();
    
    return sendSuccess(res, {
      token,
      url: env.LIVEKIT_URL
    });
  } catch (error: any) {
    return sendError(res, 500, 'Failed to generate token: ' + error.message);
  }
});
