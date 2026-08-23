import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { env } from './config/env.js';
import authRouter from './routes/auth.routes.js';
import userRouter from './routes/user.routes.js';
import postRouter from './routes/post.routes.js';
import notificationRouter from './routes/notification.routes.js';
import healthRouter from './routes/health.routes.js';
import { socialRouter } from './routes/social.routes.js';
import { musicRouter } from './routes/music.routes.js';
import { privacyRouter } from './routes/privacy.routes.js';
import { securityRouter } from './routes/security.routes.js';
import { mediaRouter } from './routes/media.routes.js';
import { groupRouter } from './routes/group.routes.js';
import { broadcastRouter } from './routes/broadcast.routes.js';
import { errorHandler } from './middleware/error.middleware.js';
import { httpsEnforcementMiddleware, trafficMonitorMiddleware, botProtectionMiddleware } from './middleware/trafficMonitor.middleware.js';
import { globalApiRateLimiter } from './middleware/rateLimit.middleware.js';

export const app = express();

app.set('trust proxy', 1);

const ALLOWED_ORIGINS = [
  'https://nexa-social-app.surge.sh',
  'http://localhost:5173',
  'http://localhost:3000'
];

if (env.CLIENT_ORIGIN && !ALLOWED_ORIGINS.includes(env.CLIENT_ORIGIN)) {
  ALLOWED_ORIGINS.push(env.CLIENT_ORIGIN);
}

app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true
}));

app.use(helmet({
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  referrerPolicy: {
    policy: 'strict-origin-when-cross-origin'
  },
  noSniff: true,
  xssFilter: true
}));

app.use(httpsEnforcementMiddleware);
app.use(botProtectionMiddleware);
app.use(trafficMonitorMiddleware);
app.use('/api', globalApiRateLimiter);
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));
app.use(cookieParser());

// Static uploads folder
const uploadsPath = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

// API Routes
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/users', userRouter);
app.use('/api/posts', postRouter);
app.use('/api/notifications', notificationRouter);
app.use('/api/security', securityRouter);
app.use('/api/privacy', privacyRouter);
app.use('/api/music', musicRouter);
app.use('/api/media', mediaRouter);
app.use('/api/groups', groupRouter);
app.use('/api/broadcasts', broadcastRouter);
app.use('/api', socialRouter);

// Root & API Welcome Endpoints
app.get(['/', '/api'], (req, res) => {
  res.json({
    status: 'online',
    app: 'Nexa Social API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      ready: '/api/health/ready',
      auth: '/api/auth',
      users: '/api/users',
      posts: '/api/posts',
      messages: '/api/messages',
      notifications: '/api/notifications',
      security: '/api/security',
      privacy: '/api/privacy',
      media: '/api/media',
      groups: '/api/groups',
      broadcasts: '/api/broadcasts'
    },
    client: 'https://nexa-social-app.surge.sh'
  });
});

// 404 Route Handler for undefined endpoints
app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.url} not found` } });
});

app.use(errorHandler);

export default app;
