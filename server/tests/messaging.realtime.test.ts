import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NexaRealtimeServer } from '../src/socket.js';
import { signAccessToken } from '../src/utils/jwt.js';
import * as factoryModule from '../src/repositories/factory.js';
import { createShortLivedTurnCredentials } from '../src/routes/call.routes.js';

describe('Messaging Security & Realtime Interoperability Suite', () => {
  let realtimeServer: NexaRealtimeServer;
  let mockIo: any;
  let emittedEvents: Array<{ room: string; event: string; payload: any }>;

  beforeEach(() => {
    vi.clearAllMocks();
    emittedEvents = [];
    realtimeServer = new NexaRealtimeServer();

    mockIo = {
      to: (room: string) => ({
        emit: (event: string, payload: any) => {
          emittedEvents.push({ room, event, payload });
        }
      })
    };
    realtimeServer.setIoServer(mockIo);
  });

  describe('Authentication & Handshake Validation', () => {
    it('authenticates valid handshake token with Bearer prefix', () => {
      const token = signAccessToken({ userId: 101, username: 'alice', email: 'alice@nexa.app' });
      const authData = realtimeServer.authenticateHandshakeToken(`Bearer ${token}`);

      expect(authData).not.toBeNull();
      expect(authData?.userId).toBe(101);
      expect(authData?.username).toBe('alice');
    });

    it('authenticates valid handshake token without Bearer prefix', () => {
      const token = signAccessToken({ userId: 102, username: 'bob', email: 'bob@nexa.app' });
      const authData = realtimeServer.authenticateHandshakeToken(token);

      expect(authData).not.toBeNull();
      expect(authData?.userId).toBe(102);
      expect(authData?.username).toBe('bob');
    });

    it('rejects empty, invalid, or expired handshake tokens', () => {
      expect(realtimeServer.authenticateHandshakeToken('')).toBeNull();
      expect(realtimeServer.authenticateHandshakeToken('invalid.jwt.token')).toBeNull();
    });
  });

  describe('Connection Lifecycle, Reconnect & Logout Disconnect', () => {
    it('tracks active socket connections and online status', () => {
      expect(realtimeServer.isUserOnline(101)).toBe(false);

      realtimeServer.registerUserSocket(101, 'socket-abc-1');
      expect(realtimeServer.isUserOnline(101)).toBe(true);

      // Reconnect / multiple tabs
      realtimeServer.registerUserSocket(101, 'socket-abc-2');
      expect(realtimeServer.isUserOnline(101)).toBe(true);

      // First tab closed
      realtimeServer.removeUserSocket(101, 'socket-abc-1');
      expect(realtimeServer.isUserOnline(101)).toBe(true);

      // Logout / disconnect all tabs
      realtimeServer.removeUserSocket(101, 'socket-abc-2');
      expect(realtimeServer.isUserOnline(101)).toBe(false);
    });
  });

  describe('Real-Time Typing Indicators', () => {
    it('delivers typing:start and typing:stop events to recipient room', () => {
      realtimeServer.handleTypingStart(101, 'alice', 202);
      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0]).toEqual({
        room: 'user:202',
        event: 'typing:start',
        payload: { userId: 101, username: 'alice', receiverId: 202 }
      });

      realtimeServer.handleTypingStop(101, 202);
      expect(emittedEvents).toHaveLength(2);
      expect(emittedEvents[1]).toEqual({
        room: 'user:202',
        event: 'typing:stop',
        payload: { userId: 101, receiverId: 202 }
      });
    });
  });

  describe('Authenticated WebRTC Signaling', () => {
    beforeEach(() => {
      realtimeServer.registerUserSocket(101, 'caller-socket');
      realtimeServer.registerUserSocket(202, 'callee-socket');
    });

    it('creates a call from the authenticated caller identity', () => {
      realtimeServer.createCall(
        { userId: 101, username: 'alice', email: 'alice@nexa.app' },
        '3f7a6010-11c0-4b2d-9494-31e90d3ba9ca',
        202,
        'video'
      );

      expect(emittedEvents[0]).toEqual({
        room: 'user:202',
        event: 'call:invite',
        payload: {
          callId: '3f7a6010-11c0-4b2d-9494-31e90d3ba9ca',
          callerId: 101,
          callerUsername: 'alice',
          callType: 'video'
        }
      });
    });

    it('creates deterministic short-lived TURN credentials without exposing the shared secret', () => {
      const credentials = createShortLivedTurnCredentials('render-only-secret', 101, 3600, 1_000);

      expect(credentials.username).toBe('4600:101');
      expect(credentials.credential).toMatch(/^[A-Za-z0-9+/]+=*$/);
      expect(credentials.credential).not.toContain('render-only-secret');
    });

    it('rejects self-calls, offline recipients, and duplicate busy calls', () => {
      expect(() => realtimeServer.createCall(
        { userId: 101, username: 'alice', email: '' },
        '3f7a6010-11c0-4b2d-9494-31e90d3ba9ca',
        101,
        'audio'
      )).toThrow('Invalid call recipient');

      expect(() => realtimeServer.createCall(
        { userId: 101, username: 'alice', email: '' },
        '4f7a6010-11c0-4b2d-9494-31e90d3ba9ca',
        303,
        'audio'
      )).toThrow('User is offline');

      realtimeServer.createCall(
        { userId: 101, username: 'alice', email: '' },
        '5f7a6010-11c0-4b2d-9494-31e90d3ba9ca',
        202,
        'audio'
      );
      expect(() => realtimeServer.createCall(
        { userId: 101, username: 'alice', email: '' },
        '6f7a6010-11c0-4b2d-9494-31e90d3ba9ca',
        202,
        'video'
      )).toThrow('User is already in another call');
    });

    it('allows only participants in an accepted call to relay SDP and ICE', () => {
      const callId = '7f7a6010-11c0-4b2d-9494-31e90d3ba9ca';
      realtimeServer.createCall(
        { userId: 101, username: 'alice', email: '' },
        callId,
        202,
        'video'
      );
      realtimeServer.acceptCall(202, callId);
      realtimeServer.relayCallSignal(101, callId, 'call:offer', { sdp: 'v=0\r\n' });
      realtimeServer.relayCallSignal(202, callId, 'call:ice-candidate', {
        candidate: {
          candidate: 'candidate:1 1 UDP 1 192.0.2.1 5000 typ host',
          sdpMid: '0',
          sdpMLineIndex: 0
        }
      });

      expect(emittedEvents.some((item) => item.room === 'user:202' && item.event === 'call:offer')).toBe(true);
      expect(emittedEvents.some((item) => item.room === 'user:101' && item.event === 'call:ice-candidate')).toBe(true);
      expect(() => realtimeServer.relayCallSignal(303, callId, 'call:answer', { sdp: 'v=0' }))
        .toThrow('Call session not found');
    });

    it('ends active calls when a participant disconnects', () => {
      const callId = '8f7a6010-11c0-4b2d-9494-31e90d3ba9ca';
      realtimeServer.createCall(
        { userId: 101, username: 'alice', email: '' },
        callId,
        202,
        'audio'
      );
      realtimeServer.handleUserOffline(101);

      expect(emittedEvents.at(-1)).toEqual({
        room: 'user:202',
        event: 'call:ended',
        payload: { callId, endedByUserId: 101, reason: 'disconnected' }
      });
      expect(() => realtimeServer.acceptCall(202, callId)).toThrow('Call session not found');
    });
  });

  describe('Two-User Delivery, Message Creation & Read Receipts', () => {
    it('creates message in repository and emits message:created to recipient', async () => {
      const mockMessageRepo = {
        sendMessage: vi.fn().mockResolvedValue({
          messageId: 888,
          senderId: 101,
          receiverId: 202,
          content: 'Hello Bob! Direct message via TLS.',
          isRead: false,
          createdAt: new Date().toISOString()
        })
      };

      vi.spyOn(factoryModule, 'getMessageRepository').mockReturnValue(mockMessageRepo as any);

      const msg = await realtimeServer.handleSendMessage(101, 202, 'Hello Bob! Direct message via TLS.');
      expect(msg.messageId).toBe(888);
      expect(msg.content).toBe('Hello Bob! Direct message via TLS.');

      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0].room).toBe('user:202');
      expect(emittedEvents[0].event).toBe('message:created');
      expect(emittedEvents[0].payload.messageId).toBe(888);
    });

    it('rejects empty message payloads', async () => {
      await expect(realtimeServer.handleSendMessage(101, 202, '   ')).rejects.toThrow(
        'Message content cannot be empty'
      );
    });

    it('emits message:read receipt back to the sender', async () => {
      const readTimestamp = new Date();
      const mockMessageRepo = {
        markMessageAsRead: vi.fn().mockResolvedValue({
          rowsAffected: 1,
          readAt: readTimestamp,
          senderId: 101
        })
      };

      vi.spyOn(factoryModule, 'getMessageRepository').mockReturnValue(mockMessageRepo as any);

      await realtimeServer.handleMessageRead(888, 202);

      expect(emittedEvents).toHaveLength(1);
      expect(emittedEvents[0].room).toBe('user:101');
      expect(emittedEvents[0].event).toBe('message:read');
      expect(emittedEvents[0].payload.messageId).toBe(888);
      expect(emittedEvents[0].payload.readByUserId).toBe(202);
    });
  });
});
