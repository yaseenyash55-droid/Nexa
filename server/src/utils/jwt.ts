import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';

export interface TokenPayload {
  userId: number;
  username: string;
  email?: string;
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: '15m'
  });
}

export function signAccessToken(payload: TokenPayload): string {
  return generateAccessToken(payload);
}

export function generateRefreshToken(payload?: TokenPayload): string {
  if (payload) {
    return jwt.sign({ ...payload, jti: crypto.randomUUID() }, env.JWT_REFRESH_SECRET, {
      expiresIn: '7d'
    });
  }
  return crypto.randomBytes(40).toString('hex');
}

export function signRefreshToken(payload: TokenPayload): string {
  return generateRefreshToken(payload);
}

export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}
