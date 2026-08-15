import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
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
import { errorHandler } from './middleware/error.middleware.js';

export const app = express();

app.use(cors({
  origin: true,
  credentials: true
}));
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
app.use('/api', socialRouter);

// Root API Welcome Endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    app: 'Nexa Social API 24/7',
    version: '1.0.0',
    health: '/api/health',
    client: 'https://nexa-social-app.surge.sh'
  });
});

// 404 Route Handler for undefined endpoints
app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.url} not found` } });
});

app.use(errorHandler);

export default app;
