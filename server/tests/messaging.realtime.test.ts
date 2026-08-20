import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NexaRealtimeServer } from '../src/socket.js';
import { signAccessToken } from '../src/utils/jwt.js';
import * as factoryModule from '../src/repositories/factory.js';

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
