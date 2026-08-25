import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { verifyAccessToken } from './utils/jwt.js';
import { getMessageRepository } from './repositories/factory.js';
import { fcmNotificationService } from './services/fcm.service.js';
import { logger } from './utils/logger.js';

export function setupSocketCluster(io: Server): void {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    logger.warn('REDIS_URL not detected. Running in single-instance memory mode.');
    return;
  }

  const pubClient = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true
  });
  const subClient = pubClient.duplicate();

  Promise.all([pubClient.connect(), subClient.connect()])
    .then(() => {
      io.adapter(createAdapter(pubClient, subClient));
      logger.info('Redis Pub/Sub adapter attached to Socket.io cluster.');
    })
    .catch((err) => {
      logger.error({ err }, 'Failed to connect Redis adapter, falling back to memory mode.');
    });
}

export interface AuthenticatedSocketData {
  userId: number;
  username: string;
  email: string;
}

export type CallType = 'audio' | 'video';
export type CallSignalKind = 'call:offer' | 'call:answer' | 'call:ice-candidate';

interface ActiveCall {
  callId: string;
  callerId: number;
  calleeId: number;
  callType: CallType;
  state: 'ringing' | 'accepted';
}

const CALL_ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

export class NexaRealtimeServer {
  private activeConnections = new Map<number, Set<string>>();
  private activeCalls = new Map<string, ActiveCall>();
  private callTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

  public authenticateHandshakeToken(token: string): AuthenticatedSocketData | null {
    try {
      if (!token) return null;
      const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
      const decoded = verifyAccessToken(cleanToken);
      if (!decoded) return null;
      return {
        userId: decoded.userId,
        username: decoded.username,
        email: decoded.email || ''
      };
    } catch {
      return null;
    }
  }

  public registerUserSocket(userId: number, socketId: string) {
    if (!this.activeConnections.has(userId)) {
      this.activeConnections.set(userId, new Set());
    }
    this.activeConnections.get(userId)!.add(socketId);
  }

  public removeUserSocket(userId: number, socketId: string) {
    if (this.activeConnections.has(userId)) {
      const set = this.activeConnections.get(userId)!;
      set.delete(socketId);
      if (set.size === 0) {
        this.activeConnections.delete(userId);
      }
    }
  }

  public isUserOnline(userId: number): boolean {
    return this.activeConnections.has(userId);
  }

  private ioInstance: any = null;

  public setIoServer(io: any) {
    this.ioInstance = io;
  }

  public emitToUser(userId: number, event: string, payload: any) {
    if (this.ioInstance) {
      this.ioInstance.to(`user:${userId}`).emit(event, payload);
    }
  }

  private requireCall(callId: string, userId: number): ActiveCall {
    const call = this.activeCalls.get(callId);
    if (!call || (call.callerId !== userId && call.calleeId !== userId)) {
      throw new Error('Call session not found');
    }
    return call;
  }

  private peerUserId(call: ActiveCall, userId: number): number {
    return call.callerId === userId ? call.calleeId : call.callerId;
  }

  private assertCallId(callId: string): void {
    if (!CALL_ID_PATTERN.test(callId || '')) {
      throw new Error('Invalid call identifier');
    }
  }

  private clearCallTimeout(callId: string): void {
    const timer = this.callTimeouts.get(callId);
    if (timer) clearTimeout(timer);
    this.callTimeouts.delete(callId);
  }

  public createCall(
    caller: AuthenticatedSocketData,
    callId: string,
    calleeId: number,
    callType: CallType
  ): ActiveCall {
    this.assertCallId(callId);
    if (!Number.isInteger(calleeId) || calleeId <= 0 || calleeId === caller.userId) {
      throw new Error('Invalid call recipient');
    }
    if (callType !== 'audio' && callType !== 'video') {
      throw new Error('Invalid call type');
    }
    if (!this.isUserOnline(calleeId)) {
      throw new Error('User is offline');
    }
    if (this.activeCalls.has(callId)) {
      throw new Error('Call identifier is already active');
    }
    const userIsBusy = [...this.activeCalls.values()].some((call) =>
      call.callerId === caller.userId ||
      call.calleeId === caller.userId ||
      call.callerId === calleeId ||
      call.calleeId === calleeId
    );
    if (userIsBusy) {
      throw new Error('User is already in another call');
    }

    const call: ActiveCall = {
      callId,
      callerId: caller.userId,
      calleeId,
      callType,
      state: 'ringing'
    };
    this.activeCalls.set(callId, call);
    const callTimeout = setTimeout(() => {
      if (this.activeCalls.get(callId)?.state !== 'ringing') return;
      this.activeCalls.delete(callId);
      this.callTimeouts.delete(callId);
      const payload = { callId, reason: 'missed' };
      this.emitToUser(caller.userId, 'call:ended', payload);
      this.emitToUser(calleeId, 'call:ended', payload);
    }, 45_000);
    callTimeout.unref?.();
    this.callTimeouts.set(callId, callTimeout);
    this.emitToUser(calleeId, 'call:invite', {
      callId,
      callerId: caller.userId,
      callerUsername: caller.username,
      callType
    });

    // Asynchronously dispatch high-priority FCM push notification to callee's devices (Android/Web)
    fcmNotificationService
      .sendCallInvitePush(calleeId, {
        callId,
        callerId: caller.userId,
        callerUsername: caller.username,
        callType
      })
      .catch(() => {
        // Safe swallow: FCM push failure should not abort socket signaling
      });

    return call;
  }

  public acceptCall(userId: number, callId: string): ActiveCall {
    const call = this.requireCall(callId, userId);
    if (call.calleeId !== userId || call.state !== 'ringing') {
      throw new Error('Call cannot be accepted');
    }
    call.state = 'accepted';
    this.clearCallTimeout(callId);
    this.emitToUser(call.callerId, 'call:accepted', {
      callId,
      acceptedByUserId: userId
    });
    return call;
  }

  public rejectCall(userId: number, callId: string, reason = 'declined'): void {
    const call = this.requireCall(callId, userId);
    if (call.calleeId !== userId || call.state !== 'ringing') {
      throw new Error('Call cannot be rejected');
    }
    this.activeCalls.delete(callId);
    this.clearCallTimeout(callId);
    this.emitToUser(call.callerId, 'call:rejected', {
      callId,
      rejectedByUserId: userId,
      reason: reason.slice(0, 80)
    });
  }

  public relayCallSignal(
    senderId: number,
    callId: string,
    event: CallSignalKind,
    payload: Record<string, unknown>
  ): void {
    const call = this.requireCall(callId, senderId);
    if (call.state !== 'accepted') {
      throw new Error('Call has not been accepted');
    }
    const targetUserId = this.peerUserId(call, senderId);

    if (event === 'call:offer' || event === 'call:answer') {
      const sdp = typeof payload.sdp === 'string' ? payload.sdp : '';
      if (!sdp || sdp.length > 200_000) throw new Error('Invalid session description');
      this.emitToUser(targetUserId, event, { callId, senderId, sdp });
      return;
    }

    const candidate = payload.candidate as Record<string, unknown> | undefined;
    const candidateText = typeof candidate?.candidate === 'string' ? candidate.candidate : '';
    if (!candidateText || candidateText.length > 4096) throw new Error('Invalid ICE candidate');
    this.emitToUser(targetUserId, event, {
      callId,
      senderId,
      candidate: {
        candidate: candidateText,
        sdpMid: typeof candidate?.sdpMid === 'string' ? candidate.sdpMid.slice(0, 128) : null,
        sdpMLineIndex: Number.isInteger(candidate?.sdpMLineIndex)
          ? Number(candidate?.sdpMLineIndex)
          : null
      }
    });
  }

  public endCall(userId: number, callId: string, reason = 'ended'): void {
    const call = this.requireCall(callId, userId);
    this.activeCalls.delete(callId);
    this.clearCallTimeout(callId);
    this.emitToUser(this.peerUserId(call, userId), 'call:ended', {
      callId,
      endedByUserId: userId,
      reason: reason.slice(0, 80)
    });
  }

  public handleUserOffline(userId: number): void {
    const calls = [...this.activeCalls.values()].filter((call) =>
      call.callerId === userId || call.calleeId === userId
    );
    for (const call of calls) {
      this.activeCalls.delete(call.callId);
      this.clearCallTimeout(call.callId);
      this.emitToUser(this.peerUserId(call, userId), 'call:ended', {
        callId: call.callId,
        endedByUserId: userId,
        reason: 'disconnected'
      });
    }
  }

  public handleTypingStart(senderId: number, username: string, receiverId: number) {
    if (receiverId) {
      this.emitToUser(receiverId, 'typing:start', {
        userId: senderId,
        username,
        receiverId
      });
    }
  }

  public handleTypingStop(senderId: number, receiverId: number) {
    if (receiverId) {
      this.emitToUser(receiverId, 'typing:stop', {
        userId: senderId,
        receiverId
      });
    }
  }

  public async handleSendMessage(senderId: number, receiverId: number, content: string) {
    if (!content || !content.trim()) {
      throw new Error('Message content cannot be empty');
    }
    const repo = getMessageRepository();
    const msg = await repo.sendMessage({
      senderId,
      receiverId,
      content: content.trim()
    });
    this.emitToUser(receiverId, 'message:created', msg);
    return msg;
  }

  public async handleMessageRead(messageId: number, receiverUserId: number) {
    if (!messageId || isNaN(messageId)) return;
    const repo = getMessageRepository();
    const result = await repo.markMessageAsRead(messageId, receiverUserId);
    if (result.rowsAffected > 0 && result.senderId) {
      this.emitToUser(result.senderId, 'message:read', {
        messageId,
        readAt: result.readAt ? result.readAt.toISOString() : new Date().toISOString(),
        readByUserId: receiverUserId
      });
    }
  }
}

export const realtimeServer = new NexaRealtimeServer();
