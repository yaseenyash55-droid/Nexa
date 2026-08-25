import { describe, expect, it, vi, beforeEach } from 'vitest';
import { FcmNotificationService, sendIncomingCallPush } from '../src/services/fcm.service.js';
import * as factoryModule from '../src/repositories/factory.js';

describe('FCM Cross-Platform Call Alert Service', () => {
  let fcmService: FcmNotificationService;
  let mockFcmTokenRepo: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFcmTokenRepo = {
      getUserTokens: vi.fn(),
      upsertToken: vi.fn(),
      revokeToken: vi.fn(),
      revokeUserTokens: vi.fn()
    };
    vi.spyOn(factoryModule, 'getFcmTokenRepository').mockReturnValue(mockFcmTokenRepo);
    fcmService = new FcmNotificationService();
  });

  describe('Payload Construction', () => {
    it('builds a high-priority FCM payload with caller metadata, room ID, and call type', () => {
      const payload = fcmService.buildCallInvitePayload({
        callId: 'call-uuid-room-12345',
        callerId: 101,
        callerUsername: 'alice_crypto',
        callerName: 'Alice Springs',
        callerAvatarUrl: 'https://cdn.nexa.app/avatars/alice.png',
        callType: 'video'
      });

      expect(payload.priority).toBe('high');
      expect(payload.content_available).toBe(true);
      expect(payload.contentAvailable).toBe(true);

      // Data payload validation
      expect(payload.data.type).toBe('CALL_INVITE');
      expect(payload.data.destination).toBe('CALL');
      expect(payload.data.callId).toBe('call-uuid-room-12345');
      expect(payload.data.roomId).toBe('call-uuid-room-12345');
      expect(payload.data.callerId).toBe('101');
      expect(payload.data.callerName).toBe('Alice Springs');
      expect(payload.data.callerUsername).toBe('alice_crypto');
      expect(payload.data.callerAvatarUrl).toBe('https://cdn.nexa.app/avatars/alice.png');
      expect(payload.data.callType).toBe('video');
      expect(payload.data.timestamp).toBeDefined();

      // Android specific overrides
      expect(payload.android?.priority).toBe('high');
      expect(payload.android?.ttl).toBe('45s');
      expect(payload.android?.notification?.channel_id).toBe('nexa_call_channel');

      // Webpush specific overrides
      expect(payload.webpush?.headers?.Urgency).toBe('high');
      expect(payload.webpush?.data?.callType).toBe('video');
    });

    it('falls back gracefully to username or default ID when displayName is not provided', () => {
      const payload = fcmService.buildCallInvitePayload({
        callId: 'call-audio-999',
        callerId: 202,
        callerUsername: 'bob_builder',
        callType: 'audio'
      });

      expect(payload.data.callerName).toBe('bob_builder');
      expect(payload.data.callType).toBe('audio');
      expect(payload.data.callerAvatarUrl).toBe('');
    });
  });

  describe('Push Dispatch Logic', () => {
    it('returns success with 0 tokens if callee has no registered devices', async () => {
      mockFcmTokenRepo.getUserTokens.mockResolvedValue([]);

      const result = await fcmService.sendCallInvitePush(303, {
        callId: 'call-audio-111',
        callerId: 101,
        callerUsername: 'alice',
        callType: 'audio'
      });

      expect(result.success).toBe(true);
      expect(result.deliveredTokensCount).toBe(0);
      expect(mockFcmTokenRepo.getUserTokens).toHaveBeenCalledWith(303);
    });

    it('processes and dispatches high-priority push payload when tokens exist', async () => {
      mockFcmTokenRepo.getUserTokens.mockResolvedValue([
        'fcm_token_device_android_1',
        'fcm_token_device_web_2'
      ]);

      const result = await fcmService.sendCallInvitePush(303, {
        callId: 'call-video-222',
        callerId: 101,
        callerUsername: 'alice',
        callType: 'video'
      });

      expect(result.success).toBe(true);
      expect(result.deliveredTokensCount).toBe(2);
      expect(mockFcmTokenRepo.getUserTokens).toHaveBeenCalledWith(303);
    });

    it('rejects invalid recipient IDs safely', async () => {
      const result = await fcmService.sendCallInvitePush(-1, {
        callId: 'call-video-333',
        callerId: 101,
        callerUsername: 'alice',
        callType: 'video'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid callee');
    });

    it('dispatches single token incoming call push via sendIncomingCallPush without throwing', async () => {
      await expect(
        sendIncomingCallPush(
          'fcm_token_device_target_1',
          { id: 101, name: 'Alice', username: 'alice' },
          'room_id_123',
          'video'
        )
      ).resolves.not.toThrow();
    });
  });
});
