import { getRepositoryManager } from '../repositories/index.js';
import { hashPassword, comparePassword, hashToken } from '../utils/hash.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken, verifyAccessToken } from '../utils/jwt.js';
import { AuthTokens, User } from '../types/index.js';
import { env } from '../config/env.js';

export class AuthService {
  private get userRepo() {
    return getRepositoryManager().userRepo;
  }

  private get authRepo() {
    return getRepositoryManager().authRepo;
  }

  async register(data: {
    username: string;
    email: string;
    password: string;
    displayName: string;
  }): Promise<{ user: User; tokens: AuthTokens; accessToken: string; refreshToken: string }> {
    const existingUsername = await this.userRepo.findByUsername(data.username);
    if (existingUsername) {
      throw { statusCode: 409, code: 'USERNAME_TAKEN', message: 'Username is already registered' };
    }

    const existingEmail = await this.userRepo.findByEmail(data.email);
    if (existingEmail) {
      throw { statusCode: 409, code: 'EMAIL_TAKEN', message: 'Email is already registered' };
    }

    const passwordHash = await hashPassword(data.password);
    const user = await this.userRepo.createUser({
      username: data.username,
      email: data.email,
      passwordHash,
      displayName: data.displayName
    });

    const accessToken = signAccessToken({ userId: user.userId, username: user.username, email: user.email });
    const refreshToken = signRefreshToken({ userId: user.userId, username: user.username, email: user.email });

    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    await this.authRepo.saveRefreshToken(user.userId, tokenHash, expiresAt);

    return { user, tokens: { accessToken, refreshToken }, accessToken, refreshToken };
  }

  async login(loginId: any, password?: string): Promise<{ user: User; tokens: AuthTokens; accessToken: string; refreshToken: string }> {
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

        throw { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid username/email or password' };
      }
    }

    // Reset counter on successful login
    if ((user.failedLoginAttempts && user.failedLoginAttempts > 0) || user.lockoutUntil || failedAttempts > 0) {
      await this.userRepo.resetLockoutState(user.userId);
    }

    const accessToken = signAccessToken({ userId: user.userId, username: user.username, email: user.email });
    const refreshToken = signRefreshToken({ userId: user.userId, username: user.username, email: user.email });

    const tokenHash = hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    await this.authRepo.saveRefreshToken(user.userId, tokenHash, expiresAt);

    return { user, tokens: { accessToken, refreshToken }, accessToken, refreshToken };
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
}
