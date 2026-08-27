import crypto from 'crypto';
import { executeSql } from '../db/pool.js';
import { executePostgresSql } from '../db/postgres.pool.js';
import { getRepositoryManager } from '../repositories/index.js';
import { signAccessToken, signRefreshToken } from '../utils/jwt.js';
import { hashToken } from '../utils/hash.js';
import { getEmailProvider } from '../utils/email.js';
import { env } from '../config/env.js';
import { AuthTokens, User } from '../types/index.js';
import { getSecurityRepository } from '../repositories/factory.js';
import { decryptTotpSeed, verifyTotp } from '../utils/mfa.js';

type ChallengeRow = {
  challengeId: string;
  userId: number;
  otpHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
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
    const hash = this.otpHash(challengeId, code);

    if (env.DATABASE_PROVIDER === 'postgres') {
      await executePostgresSql(
        `UPDATE login_otp_challenges SET consumed_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND consumed_at IS NULL`,
        [user.userId]
      );
      await executePostgresSql(
        `INSERT INTO login_otp_challenges (challenge_id, user_id, otp_hash, expires_at, attempts)
         VALUES ($1, $2, $3, $4, 0)`,
        [challengeId, user.userId, hash, expiresAt]
      );
    } else {
      await executeSql(
        `UPDATE LOGIN_OTP_CHALLENGES SET CONSUMED_AT = SYSTIMESTAMP
         WHERE USER_ID = :userId AND CONSUMED_AT IS NULL`,
        { userId: user.userId }
      );
      await executeSql(
        `INSERT INTO LOGIN_OTP_CHALLENGES (CHALLENGE_ID, USER_ID, OTP_HASH, EXPIRES_AT, ATTEMPTS)
         VALUES (:challengeId, :userId, :otpHash, :expiresAt, 0)`,
        { challengeId, userId: user.userId, otpHash: hash, expiresAt }
      );
    }

    await getEmailProvider().sendEmail({
      to: user.email,
      subject: 'Your NEXA login verification code',
      body: `Your NEXA verification code is ${code}. It expires in 10 minutes. If you did not attempt to sign in, change your password.`
    });
    const [local, domain = ''] = user.email.split('@');
    return { mfaRequired: true, challengeId, maskedEmail: `${local.slice(0, 2)}***@${domain}`, expiresInSeconds: 600 };
  }

  async complete(challengeId: string, code: string) {
    let row: ChallengeRow | null = null;

    if (env.DATABASE_PROVIDER === 'postgres') {
      const result = await executePostgresSql<{
        challenge_id: string;
        user_id: number | string;
        otp_hash: string;
        expires_at: Date | string;
        attempts: number;
        consumed_at?: Date | string | null;
      }>(
        `SELECT challenge_id, user_id, otp_hash, expires_at, attempts, consumed_at
         FROM login_otp_challenges
         WHERE challenge_id = $1`,
        [challengeId]
      );
      const r = result.rows?.[0];
      if (r) {
        row = {
          challengeId: r.challenge_id,
          userId: Number(r.user_id),
          otpHash: r.otp_hash,
          expiresAt: new Date(r.expires_at),
          attempts: Number(r.attempts),
          consumedAt: r.consumed_at ? new Date(r.consumed_at) : null
        };
      }
    } else {
      const result = await executeSql<{
        CHALLENGE_ID: string;
        USER_ID: number;
        OTP_HASH: string;
        EXPIRES_AT: Date;
        ATTEMPTS: number;
        CONSUMED_AT: Date | null;
      }>(
        `SELECT CHALLENGE_ID, USER_ID, OTP_HASH, EXPIRES_AT, ATTEMPTS, CONSUMED_AT
         FROM LOGIN_OTP_CHALLENGES
         WHERE CHALLENGE_ID = :challengeId`,
        { challengeId }
      );
      const r = result.rows?.[0];
      if (r) {
        row = {
          challengeId: r.CHALLENGE_ID,
          userId: Number(r.USER_ID),
          otpHash: r.OTP_HASH,
          expiresAt: new Date(r.EXPIRES_AT),
          attempts: Number(r.ATTEMPTS),
          consumedAt: r.CONSUMED_AT ? new Date(r.CONSUMED_AT) : null
        };
      }
    }

    if (!row || row.consumedAt) throw { statusCode: 400, code: 'INVALID_OTP_CHALLENGE', message: 'Verification request is invalid or already used' };
    if (new Date(row.expiresAt).getTime() <= Date.now()) throw { statusCode: 400, code: 'OTP_EXPIRED', message: 'Verification code expired. Sign in again.' };
    if (row.attempts >= 5) throw { statusCode: 429, code: 'OTP_ATTEMPTS_EXCEEDED', message: 'Too many incorrect codes. Sign in again.' };

    const securityRepo = getSecurityRepository();
    const settings = await securityRepo.getSecuritySettings(row.userId);
    let isCodeValid = false;

    if (settings && settings.mfaEnabled && settings.totpSecretCiphertext) {
      const parsed = JSON.parse(settings.totpSecretCiphertext);
      const secret = decryptTotpSeed({
        ciphertext: parsed.ciphertext,
        iv: parsed.iv,
        authTag: parsed.authTag
      });
      
      // 1. Check TOTP
      if (verifyTotp(code, secret)) {
        isCodeValid = true;
      } else {
        // 2. Check Recovery codes
        const hashedInput = crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
        const recoveryCodes: string[] = parsed.recoveryCodes || [];
        const matchedIndex = recoveryCodes.indexOf(hashedInput);
        if (matchedIndex !== -1) {
          isCodeValid = true;
          // Consume recovery code
          recoveryCodes.splice(matchedIndex, 1);
          parsed.recoveryCodes = recoveryCodes;
          await securityRepo.updateSecuritySettings(row.userId, {
            totpSecretCiphertext: JSON.stringify(parsed)
          });
        }
      }
    } else {
      // Fallback to Email OTP
      const expected = Buffer.from(row.otpHash, 'hex');
      const supplied = Buffer.from(this.otpHash(challengeId, code), 'hex');
      isCodeValid = expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
    }

    if (!isCodeValid) {
      if (env.DATABASE_PROVIDER === 'postgres') {
        await executePostgresSql(
          `UPDATE login_otp_challenges SET attempts = attempts + 1
           WHERE challenge_id = $1 AND consumed_at IS NULL`,
          [challengeId]
        );
      } else {
        await executeSql(
          `UPDATE LOGIN_OTP_CHALLENGES SET ATTEMPTS = ATTEMPTS + 1
           WHERE CHALLENGE_ID = :challengeId AND CONSUMED_AT IS NULL`,
          { challengeId }
        );
      }
      throw { statusCode: 401, code: 'INVALID_OTP', message: 'Verification code is incorrect' };
    }

    if (env.DATABASE_PROVIDER === 'postgres') {
      await executePostgresSql(
        `UPDATE login_otp_challenges SET consumed_at = CURRENT_TIMESTAMP
         WHERE challenge_id = $1 AND consumed_at IS NULL`,
        [challengeId]
      );
    } else {
      await executeSql(
        `UPDATE LOGIN_OTP_CHALLENGES SET CONSUMED_AT = SYSTIMESTAMP
         WHERE CHALLENGE_ID = :challengeId AND CONSUMED_AT IS NULL`,
        { challengeId }
      );
    }

    const user = await this.userRepo.findById(row.userId);
    if (!user) throw { statusCode: 404, code: 'USER_NOT_FOUND', message: 'User no longer exists' };
    const payload = { userId: user.userId, username: user.username, email: user.email };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86400000);
    await this.authRepo.saveRefreshToken(user.userId, hashToken(refreshToken), expiresAt);
    return { user: this.sanitizeUser(user), tokens: { accessToken, refreshToken } as AuthTokens, accessToken, refreshToken };
  }
}
