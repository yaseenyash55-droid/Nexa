import rateLimit from 'express-rate-limit';
import { auditLogSecurityEvent } from '../utils/securityAuditLogger.js';

export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 1000 : 30, // Limit each IP to 30 authentication requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    auditLogSecurityEvent({
      eventType: 'RATE_LIMIT_EXCEEDED',
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
      details: {
        path: req.path,
        method: req.method
      }
    });

    res.status(429).json({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'Too many authentication attempts from this IP, please try again after 15 minutes.',
        details: []
      }
    });
  }
});

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 1000 : 10, // Limit each IP to 10 login attempts per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    auditLogSecurityEvent({
      eventType: 'RATE_LIMIT_EXCEEDED',
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
      details: { path: req.path, method: req.method, category: 'LOGIN' }
    });
    res.status(429).json({
      error: {
        code: 'TOO_MANY_LOGIN_ATTEMPTS',
        message: 'Too many login attempts from this IP. Please try again in 15 minutes.',
        details: []
      }
    });
  }
});

export const accountCreationRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: process.env.NODE_ENV === 'test' ? 1000 : 5, // Limit each IP to 5 account registrations per hour
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    auditLogSecurityEvent({
      eventType: 'RATE_LIMIT_EXCEEDED',
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
      details: { path: req.path, method: req.method, category: 'ACCOUNT_CREATION' }
    });
    res.status(429).json({
      error: {
        code: 'TOO_MANY_REGISTRATIONS',
        message: 'Account creation rate limit reached. Please try again in an hour.',
        details: []
      }
    });
  }
});

export const aiAndMediaRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 1000 : 15, // Limit each IP to 15 media uploads/AI operations per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    auditLogSecurityEvent({
      eventType: 'RATE_LIMIT_EXCEEDED',
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
      details: { path: req.path, method: req.method, category: 'AI_MEDIA' }
    });
    res.status(429).json({
      error: {
        code: 'TOO_MANY_MEDIA_REQUESTS',
        message: 'Media upload and AI generation rate limit reached. Please try again in 15 minutes.',
        details: []
      }
    });
  }
});

export const globalApiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 5000 : 300, // Limit each IP to 300 requests per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    auditLogSecurityEvent({
      eventType: 'RATE_LIMIT_EXCEEDED',
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
      details: { path: req.path, method: req.method, category: 'GLOBAL_API' }
    });
    res.status(429).json({
      error: {
        code: 'TOO_MANY_REQUESTS',
        message: 'API rate limit exceeded. Please try again shortly.',
        details: []
      }
    });
  }
});
