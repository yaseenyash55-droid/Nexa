import { app } from './app.js';
import { env } from './config/env.js';
import { initializeDatabasePool, closeDatabasePool } from './db/index.js';
import { logger } from './utils/logger.js';
import { Server } from 'socket.io';
import { realtimeServer, setupSocketCluster } from './socket.js';

import { initializeFirebase } from './utils/firebase.js';

async function startServer() {
  try {
    await initializeDatabasePool();
    initializeFirebase();

    const server = app.listen(env.PORT, () => {
      logger.info(
        `Nexa Server listening on port ${env.PORT} with ${env.DATABASE_PROVIDER.toUpperCase()} Database`
      );
    });

    const allowedOrigins = [
      'https://nexa-social-app.surge.sh',
      'http://localhost:5173',
      'http://localhost:3000'
    ];
    if (env.CLIENT_ORIGIN && !allowedOrigins.includes(env.CLIENT_ORIGIN)) {
      allowedOrigins.push(env.CLIENT_ORIGIN);
    }

    const io = new Server(server, {
      cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    setupSocketCluster(io);

    io.use((socket, next) => {
      const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
      const user = realtimeServer.authenticateHandshakeToken(token);
      if (!user) {
        return next(new Error('Unauthorized socket connection'));
      }
      (socket as any).user = user;
      next();
    });

    io.on('connection', (socket) => {
      const user = (socket as any).user;
      socket.join(`user:${user.userId}`);
      realtimeServer.registerUserSocket(user.userId, socket.id);

      socket.on('typing:start', (data: { receiverId: number }) => {
        if (data?.receiverId) {
          realtimeServer.handleTypingStart(user.userId, user.username, data.receiverId);
        }
      });

      socket.on('typing:stop', (data: { receiverId: number }) => {
        if (data?.receiverId) {
          realtimeServer.handleTypingStop(user.userId, data.receiverId);
        }
      });

      socket.on('message:send', async (data: { receiverId: number; content: string }, callback?: (res: any) => void) => {
        try {
          if (data?.receiverId && data?.content) {
            const msg = await realtimeServer.handleSendMessage(user.userId, data.receiverId, data.content);
            if (callback) callback({ success: true, data: msg });
          }
        } catch (err: any) {
          if (callback) callback({ success: false, error: err.message });
        }
      });

      socket.on('message:read', async (data: { messageId: number }) => {
        if (data?.messageId) {
          await realtimeServer.handleMessageRead(data.messageId, user.userId);
        }
      });

      const acknowledge = (
        callback: ((res: { success: boolean; error?: string }) => void) | undefined,
        operation: () => void
      ) => {
        try {
          operation();
          callback?.({ success: true });
        } catch (error) {
          callback?.({
            success: false,
            error: error instanceof Error ? error.message : 'Call operation failed'
          });
        }
      };

      socket.on('call:invite', (data: any, callback?: (res: any) => void) => {
        acknowledge(callback, () => realtimeServer.createCall(
          user,
          data?.callId,
          Number(data?.targetUserId),
          data?.callType
        ));
      });

      socket.on('call:accept', (data: any, callback?: (res: any) => void) => {
        acknowledge(callback, () => realtimeServer.acceptCall(user.userId, data?.callId));
      });

      socket.on('call:reject', (data: any, callback?: (res: any) => void) => {
        acknowledge(callback, () => realtimeServer.rejectCall(user.userId, data?.callId, data?.reason));
      });

      socket.on('call:offer', (data: any, callback?: (res: any) => void) => {
        acknowledge(callback, () => realtimeServer.relayCallSignal(user.userId, data?.callId, 'call:offer', data));
      });

      socket.on('call:answer', (data: any, callback?: (res: any) => void) => {
        acknowledge(callback, () => realtimeServer.relayCallSignal(user.userId, data?.callId, 'call:answer', data));
      });

      socket.on('call:ice-candidate', (data: any, callback?: (res: any) => void) => {
        acknowledge(callback, () => realtimeServer.relayCallSignal(user.userId, data?.callId, 'call:ice-candidate', data));
      });

      socket.on('call:end', (data: any, callback?: (res: any) => void) => {
        acknowledge(callback, () => realtimeServer.endCall(user.userId, data?.callId, data?.reason));
      });

      socket.on('disconnect', () => {
        realtimeServer.removeUserSocket(user.userId, socket.id);
        if (!realtimeServer.isUserOnline(user.userId)) {
          realtimeServer.handleUserOffline(user.userId);
        }
      });
    });

    realtimeServer.setIoServer(io);

    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        await closeDatabasePool();
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    logger.error({ err }, 'Failed to start Nexa Server');
    process.exit(1);
  }
}

startServer();
