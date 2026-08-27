import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.js';
import { auditLogSecurityEvent, hashIp } from '../utils/securityAuditLogger.js';

interface RequestTrack {
  count: number;
  errorCount: number;
  firstRequestMs: number;
}

const ipTrackMap = new Map<string, RequestTrack>();
const WINDOW_MS = 60 * 1000; // 1-minute tracking window
const ANOMALY_REQUEST_THRESHOLD = 120; // 120 requests/minute from single IP
const ANOMALY_ERROR_THRESHOLD = 30; // 30 4xx/5xx errors/minute from single IP

export function trafficMonitorMiddleware(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress;
  const ipHash = hashIp(ip);
  const now = Date.now();

  let track = ipTrackMap.get(ipHash);
  if (!track || (now - track.firstRequestMs) > WINDOW_MS) {
    track = { count: 1, errorCount: 0, firstRequestMs: now };
    ipTrackMap.set(ipHash, track);
  } else {
    track.count += 1;
  }

  if (track.count === ANOMALY_REQUEST_THRESHOLD) {
    auditLogSecurityEvent({
      eventType: 'ANOMALY_DETECTED',
      ip,
      userAgent: req.get('user-agent'),
      details: {
        reason: 'UNUSUAL_TRAFFIC_BURST',
        requestCount: track.count,
        path: req.path
      }
    });
  }

  res.on('finish', () => {
    if (res.statusCode >= 400) {
      track!.errorCount += 1;
      if (track!.errorCount === ANOMALY_ERROR_THRESHOLD) {
        auditLogSecurityEvent({
          eventType: 'ANOMALY_DETECTED',
          ip,
          userAgent: req.get('user-agent'),
          details: {
            reason: 'HIGH_API_ERROR_BURST',
            errorCount: track!.errorCount,
            statusCode: res.statusCode,
            path: req.path
          }
        });
      }
    }
  });

  next();
}

export function httpsEnforcementMiddleware(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === 'production') {
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    if (!isHttps) {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
  }
  next();
}

const SUSPICIOUS_BOT_USER_AGENTS = [
  'scrapy',
  'libwww-perl',
  'zgrab',
  'nmap',
  'sqlmap',
  'nikto',
  'masscan',
  'binlar',
  'casper',
  'checkpriv',
  'dirbuster'
];

export function botProtectionMiddleware(req: Request, res: Response, next: NextFunction) {
  const userAgent = (req.get('user-agent') || '').toLowerCase();

  const isSuspicious = SUSPICIOUS_BOT_USER_AGENTS.some(bot => userAgent.includes(bot));
  if (isSuspicious) {
    auditLogSecurityEvent({
      eventType: 'ANOMALY_DETECTED',
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
      details: {
        reason: 'AUTOMATED_SCRAPER_BLOCKED',
        path: req.path,
        method: req.method
      }
    });

    return sendError(res, 'BOT_ACCESS_DENIED', 'Access denied: automated scraping tool detected', 403);
  }

  next();
}
