import { app } from './app.js';
import { env } from './config/env.js';
import { initializeOraclePool, closeOraclePool } from './db/pool.js';
import { logger } from './utils/logger.js';
import { Server } from 'socket.io';
import { realtimeServer } from './socket.js';

async function startServer() {
  try {
    if (env.DATA_SOURCE === 'oracle') {
      await initializeOraclePool();
    } else {
      logger.info('Starting server in MOCK mode');
    }

    const server = app.listen(env.PORT, () => {
      logger.info(`Nexa Server listening on port ${env.PORT} (DATA_SOURCE=${env.DATA_SOURCE})`);
    });

    const io = new Server(server, {
      cors: {
        origin: env.CLIENT_ORIGIN,
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

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

      socket.on('disconnect', () => {
        realtimeServer.removeUserSocket(user.userId, socket.id);
      });
    });

    realtimeServer.setIoServer(io);

    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        await closeOraclePool();
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
