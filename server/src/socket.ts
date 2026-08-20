import { verifyAccessToken } from './utils/jwt.js';
import { getMessageRepository } from './repositories/factory.js';

export interface AuthenticatedSocketData {
  userId: number;
  username: string;
  email: string;
}

export class NexaRealtimeServer {
  private activeConnections = new Map<number, Set<string>>();

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
