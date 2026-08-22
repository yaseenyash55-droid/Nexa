import crypto from 'crypto';
import { getRepositoryManager } from '../repositories/index.js';
import { hashPassword, comparePassword, hashToken } from '../utils/hash.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken, verifyAccessToken } from '../utils/jwt.js';
import { AuthTokens, User } from '../types/index.js';
import { env } from '../config/env.js';
import { getEmailProvider } from '../utils/email.js';
import { auditLogSecurityEvent } from '../utils/securityAuditLogger.js';
import { withDatabaseTransaction as withTransaction } from '../db/index.js';
import { EmailOtpService } from './email-otp.service.js';

export class AuthService {
  private readonly emailOtpService = new EmailOtpService();
  private get userRepo() {
    return getRepositoryManager().userRepo;
  }

  private get authRepo() {
    return getRepositoryManager().authRepo;
  }

  private get securityRepo() {
    return getRepositoryManager().securityRepo;
  }

  public sanitizeUser(user: User): User {
    const sanitized = { ...user };
    delete sanitized.passwordHash;
    delete sanitized.failedLoginAttempts;
    delete sanitized.firstFailedAttemptAt;
    delete sanitized.lockoutUntil;
    return sanitized;
  }

  async register(data: {
    username: string;
    email: string;
    password: string;
    displayName: string;
  }): Promise<{ user: User; tokens: AuthTokens; accessToken: string; refreshToken: string }> {
    // Normalize inputs before any duplicate checks
    const normalizedUsername = data.username.trim().toLowerCase();
    const normalizedEmail = data.email.trim().toLowerCase();

    const existingUsername = await this.userRepo.findByUsername(normalizedUsername);
    if (existingUsername) {
      throw { statusCode: 409, code: 'USERNAME_TAKEN', message: 'Username is already registered' };
    }

    const existingEmail = await this.userRepo.findByEmail(normalizedEmail);
    if (existingEmail) {
      throw { statusCode: 409, code: 'EMAIL_TAKEN', message: 'Email is already registered' };
    }

    const passwordHash = await hashPassword(data.password);

    // Atomic: insert user + refresh token in one transaction
    const result = await withTransaction(async (conn) => {
      // 1. Insert user
      const rawUser = await (this.userRepo as any).createUserOnConnection(conn, {
        username: normalizedUsername,
        email: normalizedEmail,
        passwordHash,
        displayName: data.displayName.trim()
      });

      // 2. Generate tokens with the real userId
      const tokenPayload = { userId: rawUser.userId, username: rawUser.username, email: rawUser.email };
      const accessToken = signAccessToken(tokenPayload);
      const refreshToken = signRefreshToken(tokenPayload);

      // 3. Insert refresh token (same transaction)
      const tokenHash = hashToken(refreshToken);
      const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
      await (this.authRepo as any).saveRefreshTokenOnConnection(conn, rawUser.userId, tokenHash, expiresAt);

      return { rawUser, accessToken, refreshToken };
    });

    const user = this.sanitizeUser(result.rawUser);

    // Auto-trigger verification email dispatch (fire-and-forget, outside transaction)
    await this.sendEmailVerification(user.userId, user.email).catch(() => {});

    return {
      user,
      tokens: { accessToken: result.accessToken, refreshToken: result.refreshToken },
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    };
  }

  async login(loginId: any, password?: string): Promise<any> {
    const credentials = typeof loginId === 'object' && loginId !== null
      ? loginId
      : { emailOrUsername: loginId, password };

    const searchKey = credentials.emailOrUsername || credentials.username || credentials.email || '';
    const isEmail = searchKey.includes('@');
    const user = isEmail
      ? await this.userRepo.findByEmail(searchKey)
      : await this.userRepo.findByUsername(searchKey);

    if (!user) {
      throw { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid username/email or password' };
    }

    const now = Date.now();
    const lockoutUntilMs = user.lockoutUntil ? new Date(user.lockoutUntil).getTime() : 0;

    // 1. Check if account is currently locked out
    if (lockoutUntilMs > now) {
      const remainingMs = lockoutUntilMs - now;
      const remainingMinutes = Math.ceil(remainingMs / (60 * 1000));
      throw {
        statusCode: 423,
        code: 'ACCOUNT_LOCKED',
        message: `Account is locked due to too many failed login attempts. Please try again in ${remainingMinutes} minute(s).`
      };
    }

    // 2. Window logic: 15-minute attempt window (900,000 ms), 30-minute lockout (1,800,000 ms)
    const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
    const LOCKOUT_DURATION_MS = 30 * 60 * 1000;

    let failedAttempts = user.failedLoginAttempts || 0;
    let firstAttemptMs = user.firstFailedAttemptAt ? new Date(user.firstFailedAttemptAt).getTime() : 0;

    // Reset window if lock expired or first attempt is > 15m ago
    if (lockoutUntilMs > 0 && lockoutUntilMs <= now) {
      failedAttempts = 0;
      firstAttemptMs = 0;
    } else if (firstAttemptMs > 0 && (now - firstAttemptMs) > ATTEMPT_WINDOW_MS) {
      failedAttempts = 0;
      firstAttemptMs = 0;
    }

    const credential = await this.userRepo.findCredentialById(user.userId);
    const passwordHash = credential?.passwordHash || (user as any).passwordHash;

    const isMatch = passwordHash ? await comparePassword(credentials.password, passwordHash) : false;

    if (!isMatch) {
      failedAttempts += 1;
      if (firstAttemptMs === 0) {
        firstAttemptMs = now;
      }

      if (failedAttempts >= 5) {
        const lockoutUntil = new Date(now + LOCKOUT_DURATION_MS);
        await this.userRepo.updateLockoutState(
          user.userId,
          failedAttempts,
          new Date(firstAttemptMs),
          lockoutUntil
        );

        auditLogSecurityEvent({
          eventType: 'ACCOUNT_LOCKOUT',
          userId: user.userId,
          username: user.username
        });

        throw {
          statusCode: 423,
          code: 'ACCOUNT_LOCKED',
          message: 'Account is locked due to too many failed login attempts. Please try again in 30 minute(s).'
        };
      } else {
        await this.userRepo.updateLockoutState(
          user.userId,
          failedAttempts,
          new Date(firstAttemptMs),
          null
        );

        auditLogSecurityEvent({
          eventType: 'AUTH_FAILURE',
          username: searchKey
        });

        throw { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid username/email or password' };
      }
    }

    // Reset counter on successful login
    if ((user.failedLoginAttempts && user.failedLoginAttempts > 0) || user.lockoutUntil || failedAttempts > 0) {
      await this.userRepo.resetLockoutState(user.userId);
    }

    auditLogSecurityEvent({
      eventType: 'AUTH_SUCCESS',
      userId: user.userId,
      username: user.username
    });

    const securitySettings = await this.securityRepo.getSecuritySettings(user.userId);
    if (securitySettings?.mfaEnabled) return this.emailOtpService.begin(user);

    const accessToken = signAccessToken({ userId: user.userId, username: user.username, email: user.email });
    const refreshToken = signRefreshToken({ userId: user.userId, username: user.username, email: user.email });

    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    await this.authRepo.saveRefreshToken(user.userId, tokenHash, expiresAt);

    const sanitizedUser = this.sanitizeUser(user);

    return { user: sanitizedUser, tokens: { accessToken, refreshToken }, accessToken, refreshToken };
  }

  async verifyLoginOtp(challengeId: string, code: string) {
    return this.emailOtpService.complete(challengeId, code);
  }

  async refreshTokens(refreshToken?: string, authHeaderToken?: string): Promise<AuthTokens & { accessToken: string; newRefreshToken: string }> {
    let payload: { userId: number; username: string; email?: string } | null = null;
    let targetToken = refreshToken;

    if (refreshToken) {
      try {
        payload = verifyRefreshToken(refreshToken);
      } catch {
        payload = null;
      }
    }

    if (!payload && authHeaderToken) {
      try {
        payload = verifyAccessToken(authHeaderToken);
        targetToken = authHeaderToken;
      } catch {
        payload = null;
      }
    }

    if (!payload || !targetToken) {
      throw { statusCode: 401, code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token is missing or expired' };
    }

    const tokenHash = hashToken(targetToken);
    const storedToken = await this.authRepo.findRefreshToken(tokenHash);

    if (!storedToken) {
      throw { statusCode: 401, code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token is invalid or does not exist' };
    }

    if (storedToken.revokedAt) {
      throw { statusCode: 401, code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token has been revoked' };
    }

    if (new Date(storedToken.expiresAt).getTime() <= Date.now()) {
      throw { statusCode: 401, code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token has expired' };
    }

    const userId = storedToken.userId || payload.userId;
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw { statusCode: 401, code: 'USER_NOT_FOUND', message: 'User associated with token no longer exists' };
    }

    // Revoke old refresh token (Rotation)
    await this.authRepo.revokeRefreshToken(tokenHash);

    // Issue new access and refresh tokens
    const newAccessToken = signAccessToken({ userId: user.userId, username: user.username, email: user.email });
    const newRefreshToken = signRefreshToken({ userId: user.userId, username: user.username, email: user.email });

    // Save new refresh token in DB
    const newTokenHash = hashToken(newRefreshToken);
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    await this.authRepo.saveRefreshToken(user.userId, newTokenHash, expiresAt);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      newRefreshToken: newRefreshToken
    };
  }

  async logout(rawRefreshToken?: string): Promise<void> {
    if (!rawRefreshToken) return;
    const tokenHash = hashToken(rawRefreshToken);
    await this.authRepo.revokeRefreshToken(tokenHash);
  }

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      // Prevent user enumeration attacks
      return { message: 'If an account with that email exists, password reset instructions have been sent.' };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const RESET_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await this.authRepo.savePasswordResetToken(user.userId, tokenHash, expiresAt);

    const emailProvider = getEmailProvider();
    await emailProvider.sendEmail({
      to: user.email,
      subject: 'Nexa Social Password Reset Request',
      body: `You requested a password reset. Use this reset token (valid for 15 minutes): ${rawToken}`
    });

    return { message: 'If an account with that email exists, password reset instructions have been sent.' };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    const tokenHash = hashToken(token);
    const resetRecord = await this.authRepo.findPasswordResetToken(tokenHash);

    if (!resetRecord || resetRecord.usedAt) {
      throw { statusCode: 400, code: 'INVALID_RESET_TOKEN', message: 'Password reset token is invalid or has already been used' };
    }

    if (new Date(resetRecord.expiresAt).getTime() <= Date.now()) {
      throw { statusCode: 400, code: 'EXPIRED_RESET_TOKEN', message: 'Password reset token has expired' };
    }

    const newPasswordHash = await hashPassword(newPassword);
    
    // Update credentials & reset lockout counter
    const user = await this.userRepo.findById(resetRecord.userId);
    if (!user) {
      throw { statusCode: 404, code: 'USER_NOT_FOUND', message: 'User associated with token no longer exists' };
    }

    // Reuse createUser / updateUser credentials mapping
    await (this.userRepo as any).createUser?.({
      username: user.username,
      email: user.email,
      passwordHash: newPasswordHash,
      displayName: user.displayName
    });

    await this.authRepo.markPasswordResetTokenUsed(tokenHash);
    await this.authRepo.revokeAllUserTokens(user.userId);
    await this.userRepo.resetLockoutState(user.userId);

    return { message: 'Password reset successful. All active sessions have been invalidated.' };
  }

  async sendEmailVerification(userId: number, email?: string): Promise<{ message: string }> {
    const normalizedEmail = email?.trim().toLowerCase();

    const user = userId > 0
      ? await this.userRepo.findById(userId)
      : normalizedEmail
        ? await this.userRepo.findByEmail(normalizedEmail)
        : null;

    const recipientEmail = normalizedEmail || user?.email;
    if (!recipientEmail || !user) {
      throw { statusCode: 404, code: 'USER_NOT_FOUND', message: 'User for verification not found' };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours TTL
    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);

    await this.authRepo.saveEmailVerificationToken(user.userId, tokenHash, expiresAt);

    const emailProvider = getEmailProvider();
    await emailProvider.sendEmail({
      to: recipientEmail,
      subject: 'Verify your Nexa Social Account',
      body: `Welcome to Nexa! Please verify your email using this token (valid for 24 hours): ${rawToken}`
    });

    return { message: 'Verification email has been sent.' };
  }

  async verifyEmailToken(token: string): Promise<{ message: string }> {
    const tokenHash = hashToken(token);
    const record = await this.authRepo.findEmailVerificationToken(tokenHash);

    if (!record || record.usedAt) {
      throw { statusCode: 400, code: 'INVALID_VERIFICATION_TOKEN', message: 'Email verification token is invalid or has already been used' };
    }

    if (new Date(record.expiresAt).getTime() <= Date.now()) {
      throw { statusCode: 400, code: 'EXPIRED_VERIFICATION_TOKEN', message: 'Email verification token has expired' };
    }

    await this.securityRepo.updateSecuritySettings(record.userId, { emailVerifiedAt: new Date() });
    await this.authRepo.markEmailVerificationTokenUsed(tokenHash);

    return { message: 'Email verified successfully.' };
  }
}

