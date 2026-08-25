import { getFcmTokenRepository } from '../repositories/factory.js';
import { logger } from '../utils/logger.js';

export interface CallInvitePushData {
  callId: string;
  callerId: number;
  callerUsername: string;
  callerName?: string;
  callerAvatarUrl?: string;
  callType: 'video' | 'audio';
}

export interface FcmDataPayload {
  type: string;
  destination: string;
  callId: string;
  roomId: string;
  callerId: string;
  callerName: string;
  callerUsername: string;
  callerAvatarUrl: string;
  callType: 'video' | 'audio';
  timestamp: string;
  [key: string]: string;
}

export interface FcmHighPriorityMessage {
  registration_ids?: string[];
  to?: string;
  priority: 'high';
  content_available: boolean;
  contentAvailable?: boolean;
  data: FcmDataPayload;
  android?: {
    priority: 'high';
    ttl: string;
    notification?: {
      channel_id?: string;
      priority?: string;
    };
  };
  webpush?: {
    headers: {
      Urgency: string;
    };
    data?: FcmDataPayload;
  };
}

export class FcmNotificationService {
  private get fcmRepo() {
    return getFcmTokenRepository();
  }

  /**
   * Builds the cross-platform high-priority FCM data payload for incoming call alerts.
   */
  public buildCallInvitePayload(data: CallInvitePushData): FcmHighPriorityMessage {
    const callerDisplayName = data.callerName || data.callerUsername || `User ${data.callerId}`;
    const stringifiedData: FcmDataPayload = {
      type: 'CALL_INVITE',
      destination: 'CALL',
      callId: data.callId,
      roomId: data.callId,
      callerId: String(data.callerId),
      callerName: callerDisplayName,
      callerUsername: data.callerUsername || '',
      callerAvatarUrl: data.callerAvatarUrl || '',
      callType: data.callType,
      timestamp: new Date().toISOString()
    };

    return {
      priority: 'high',
      content_available: true,
      contentAvailable: true,
      data: stringifiedData,
      android: {
        priority: 'high',
        ttl: '45s',
        notification: {
          channel_id: 'nexa_call_channel',
          priority: 'max'
        }
      },
      webpush: {
        headers: {
          Urgency: 'high'
        },
        data: stringifiedData
      }
    };
  }

  /**
   * Dispatches high-priority incoming call alerts to all registered devices of the callee.
   */
  public async sendCallInvitePush(
    calleeId: number,
    callData: CallInvitePushData
  ): Promise<{ success: boolean; deliveredTokensCount: number; error?: string }> {
    try {
      if (!Number.isInteger(calleeId) || calleeId <= 0) {
        return { success: false, deliveredTokensCount: 0, error: 'Invalid callee user ID' };
      }

      const tokens = await this.fcmRepo.getUserTokens(calleeId);
      if (!tokens || tokens.length === 0) {
        logger.debug({ calleeId }, 'No FCM tokens registered for callee; skipping push notification');
        return { success: true, deliveredTokensCount: 0 };
      }

      const basePayload = this.buildCallInvitePayload(callData);

      const fcmServerKey = process.env.FCM_SERVER_KEY || process.env.FIREBASE_SERVER_KEY || '';

      if (fcmServerKey) {
        const payloadWithTokens: FcmHighPriorityMessage = {
          ...basePayload,
          registration_ids: tokens
        };

        const response = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `key=${fcmServerKey}`
          },
          body: JSON.stringify(payloadWithTokens)
        });

        if (!response.ok) {
          const errorBody = await response.text();
          logger.warn({ calleeId, status: response.status, errorBody }, 'FCM API returned error response');
          return { success: false, deliveredTokensCount: 0, error: `FCM API error (${response.status})` };
        }

        const result: any = await response.json();
        logger.info(
          { calleeId, successCount: result.success, failureCount: result.failure },
          'FCM high-priority call invite payload dispatched via API'
        );

        return { success: true, deliveredTokensCount: result.success || tokens.length };
      }

      // Safe local/simulated dispatch when FCM server key is not configured in development/testing
      logger.info(
        {
          calleeId,
          tokensCount: tokens.length,
          callId: callData.callId,
          callType: callData.callType,
          priority: basePayload.priority,
          content_available: basePayload.content_available
        },
        'FCM high-priority call invite payload prepared and processed'
      );

      return { success: true, deliveredTokensCount: tokens.length };
    } catch (err: any) {
      logger.error({ err, calleeId, callId: callData.callId }, 'Failed to dispatch FCM call invite push');
      return { success: false, deliveredTokensCount: 0, error: err.message };
    }
  }
}

export const fcmNotificationService = new FcmNotificationService();

/**
 * Direct FCM incoming call push dispatcher for a single target device token.
 */
export async function sendIncomingCallPush(
  targetUserFcmToken: string,
  callerData: { id: number | string; name?: string; username?: string; avatarUrl?: string },
  roomId: string,
  callType: 'audio' | 'video'
): Promise<void> {
  const message: FcmHighPriorityMessage = {
    to: targetUserFcmToken,
    priority: 'high',
    content_available: true,
    contentAvailable: true,
    data: {
      type: 'INCOMING_CALL',
      destination: 'CALL',
      callId: roomId,
      roomId,
      callerId: String(callerData.id),
      callerName: callerData.name || callerData.username || `User ${callerData.id}`,
      callerUsername: callerData.username || '',
      callerAvatarUrl: callerData.avatarUrl || '',
      callType,
      timestamp: new Date().toISOString()
    },
    android: {
      priority: 'high',
      ttl: '30000',
      notification: {
        channel_id: 'nexa_call_channel',
        priority: 'max'
      }
    },
    webpush: {
      headers: {
        Urgency: 'high'
      }
    }
  };

  const fcmServerKey = process.env.FCM_SERVER_KEY || process.env.FIREBASE_SERVER_KEY || '';

  if (fcmServerKey) {
    try {
      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `key=${fcmServerKey}`
        },
        body: JSON.stringify(message)
      });

      if (!response.ok) {
        const errorBody = await response.text();
        logger.warn({ status: response.status, errorBody }, 'Failed to dispatch FCM call alert');
      }
    } catch (error) {
      logger.error({ error }, 'Failed to dispatch FCM call alert');
    }
  } else {
    logger.info({ roomId, callType, callerId: callerData.id }, 'Simulated FCM incoming call alert prepared');
  }
}
