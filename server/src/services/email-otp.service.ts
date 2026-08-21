import crypto from 'crypto';
import { executeSql } from '../db/pool.js';
import { getRepositoryManager } from '../repositories/index.js';
import { signAccessToken, signRefreshToken } from '../utils/jwt.js';
import { hashToken } from '../utils/hash.js';
import { getEmailProvider } from '../utils/email.js';
import { env } from '../config/env.js';
import { AuthTokens, User } from '../types/index.js';

type ChallengeRow = {
  CHALLENGE_ID: string;
  USER_ID: number;
  OTP_HASH: string;
  EXPIRES_AT: Date;
  ATTEMPTS: number;
  CONSUMED_AT: Date | null;
};

export class EmailOtpService {
  private get userRepo() { return getRepositoryManager().userRepo; }
  private get authRepo() { return getRepositoryManager().authRepo; }

  private otpHash(challengeId: string, code: string): string {
    const pepper = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
    if (!pepper) throw new Error('JWT access secret is required for OTP hashing');
    return crypto.createHmac('sha256', pepper).update(`${challengeId}:${code}`).digest('hex');
  }

  private sanitizeUser(user: User): User {
    const sanitized = { ...user };
    delete sanitized.passwordHash;
    delete sanitized.failedLoginAttempts;
    delete sanitized.firstFailedAttemptAt;
    delete sanitized.lockoutUntil;
    return sanitized;
  }

  async begin(user: User) {
    const challengeId = crypto.randomBytes(32).toString('hex');
    const code = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await executeSql(`UPDATE LOGIN_OTP_CHALLENGES SET CONSUMED_AT = SYSTIMESTAMP
      WHERE USER_ID = :userId AND CONSUMED_AT IS NULL`, { userId: user.userId });
    await executeSql(`INSERT INTO LOGIN_OTP_CHALLENGES
      (CHALLENGE_ID, USER_ID, OTP_HASH, EXPIRES_AT, ATTEMPTS)
      VALUES (:challengeId, :userId, :otpHash, :expiresAt, 0)`, {
      challengeId, userId: user.userId, otpHash: this.otpHash(challengeId, code), expiresAt
    });
    await getEmailProvider().sendEmail({
      to: user.email,
      subject: 'Your NEXA login verification code',
      body: `Your NEXA verification code is ${code}. It expires in 10 minutes. If you did not attempt to sign in, change your password.`
    });
    const [local, domain = ''] = user.email.split('@');
    return { mfaRequired: true, challengeId, maskedEmail: `${local.slice(0, 2)}***@${domain}`, expiresInSeconds: 600 };
  }

  async complete(challengeId: string, code: string) {
    const result = await executeSql<ChallengeRow>(`SELECT CHALLENGE_ID, USER_ID, OTP_HASH,
      EXPIRES_AT, ATTEMPTS, CONSUMED_AT FROM LOGIN_OTP_CHALLENGES
      WHERE CHALLENGE_ID = :challengeId`, { challengeId });
    const row = result.rows?.[0];
    if (!row || row.CONSUMED_AT) throw { statusCode: 400, code: 'INVALID_OTP_CHALLENGE', message: 'Verification request is invalid or already used' };
    if (new Date(row.EXPIRES_AT).getTime() <= Date.now()) throw { statusCode: 400, code: 'OTP_EXPIRED', message: 'Verification code expired. Sign in again.' };
    if (row.ATTEMPTS >= 5) throw { statusCode: 429, code: 'OTP_ATTEMPTS_EXCEEDED', message: 'Too many incorrect codes. Sign in again.' };
    const expected = Buffer.from(row.OTP_HASH, 'hex');
    const supplied = Buffer.from(this.otpHash(challengeId, code), 'hex');
    if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) {
      await executeSql(`UPDATE LOGIN_OTP_CHALLENGES SET ATTEMPTS = ATTEMPTS + 1
        WHERE CHALLENGE_ID = :challengeId AND CONSUMED_AT IS NULL`, { challengeId });
      throw { statusCode: 401, code: 'INVALID_OTP', message: 'Verification code is incorrect' };
    }
    await executeSql(`UPDATE LOGIN_OTP_CHALLENGES SET CONSUMED_AT = SYSTIMESTAMP
      WHERE CHALLENGE_ID = :challengeId AND CONSUMED_AT IS NULL`, { challengeId });
    const user = await this.userRepo.findById(row.USER_ID);
    if (!user) throw { statusCode: 404, code: 'USER_NOT_FOUND', message: 'User no longer exists' };
    const payload = { userId: user.userId, username: user.username, email: user.email };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86400000);
    await this.authRepo.saveRefreshToken(user.userId, hashToken(refreshToken), expiresAt);
    return { user: this.sanitizeUser(user), tokens: { accessToken, refreshToken } as AuthTokens, accessToken, refreshToken };
  }
}
