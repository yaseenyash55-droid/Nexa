import crypto from 'crypto';
import { logger } from './logger.js';

export type SecurityEventType =
  | 'AUTH_SUCCESS'
  | 'AUTH_FAILURE'
  | 'ACCOUNT_LOCKOUT'
  | 'PASSWORD_RESET_REQUEST'
  | 'PASSWORD_RESET_SUCCESS'
  | 'EMAIL_VERIFICATION_SENT'
  | 'EMAIL_VERIFIED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'ANOMALY_DETECTED'
  | 'UNAUTHORIZED_ACCESS';

export interface SecurityAuditEvent {
  eventType: SecurityEventType;
  userId?: number;
  username?: string;
  ip?: string;
  userAgent?: string;
  details?: Record<string, any>;
}

export function hashIp(ip?: string): string {
  if (!ip) return 'unknown';
  return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
}

export function auditLogSecurityEvent(event: SecurityAuditEvent): void {
  const payload = {
    audit: true,
    eventType: event.eventType,
    userId: event.userId || null,
    username: event.username || null,
    ipHash: hashIp(event.ip),
    userAgent: event.userAgent || 'unknown',
    timestamp: new Date().toISOString(),
    details: event.details || {}
  };

  if (event.eventType.includes('FAILURE') || event.eventType.includes('LOCKOUT') || event.eventType.includes('EXCEEDED') || event.eventType.includes('ANOMALY')) {
    logger.warn(payload, `[SECURITY AUDIT] ${event.eventType}`);
  } else {
    logger.info(payload, `[SECURITY AUDIT] ${event.eventType}`);
  }
}
