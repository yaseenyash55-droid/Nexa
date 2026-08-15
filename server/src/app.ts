import express from 'express';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error.middleware.js';

import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import postRoutes from './routes/post.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import healthRoutes from './routes/health.routes.js';
import { socialRouter } from './routes/social.routes.js';
import { securityRouter } from './routes/security.routes.js';
import { privacyRouter } from './routes/privacy.routes.js';
import { mediaRouter } from './routes/media.routes.js';

export const app = express();

// Trust single reverse proxy (Nginx) for secure cookies and X-Forwarded-For IP resolution
app.set('trust proxy', 1);

// Middleware setup
app.use(helmet({
  crossOriginResourcePolicy: false
}));
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin or any web origin in live staging mode
    callback(null, true);
  },
  credentials: true
}));
app.use(cookieParser());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb', parameterLimit: 500000 }));

import { musicRouter } from './routes/music.routes.js';

// Route registrations
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/security', securityRouter);
app.use('/api/privacy', privacyRouter);
app.use('/api/music', musicRouter);
app.use('/api/media', mediaRouter);
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));
app.use('/api', socialRouter);

// Serve Frontend Static Assets (Unified Same-Origin Production Engine)
const clientDistPath = path.join(process.cwd(), '../client/dist');
app.use(express.static(clientDistPath));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return next();
  }
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

// Error Handling Middleware
app.use(errorHandler);
