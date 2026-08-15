import { getUserRepository, getAuthRepository } from '../repositories/factory.js';
import { hashPassword, comparePassword, hashToken } from '../utils/hash.js';
import { generateAccessToken, generateRefreshToken, verifyAccessToken } from '../utils/jwt.js';
import { env } from '../config/env.js';
import { User } from '../types/index.js';

export class AuthService {
  private get userRepo() {
    return getUserRepository();
  }

  private get authRepo() {
    return getAuthRepository();
  }

  async register(data: {
    username: string;
    email: string;
    password: string;
    displayName: string;
    bio?: string;
    location?: string;
    websiteUrl?: string;
  }): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    const existingUsername = await this.userRepo.findByUsername(data.username);
    if (existingUsername) {
      throw { statusCode: 409, code: 'USERNAME_TAKEN', message: 'Username is already taken' };
    }

    const existingEmail = await this.userRepo.findByEmail(data.email);
    if (existingEmail) {
      throw { statusCode: 409, code: 'EMAIL_REGISTERED', message: 'Email is already registered' };
    }

    const passwordHash = await hashPassword(data.password);

    const createdUser = await this.userRepo.createUser({
      username: data.username,
      email: data.email,
      passwordHash,
      displayName: data.displayName,
      bio: data.bio,
      location: data.location,
      websiteUrl: data.websiteUrl
    });

    const user = { ...createdUser };
    delete user.passwordHash;

    const accessToken = generateAccessToken({
      userId: user.userId,
      username: user.username,
      email: user.email
    });

    const refreshToken = generateRefreshToken();
    const refreshTokenHash = hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_TTL_DAYS);

    await this.authRepo.saveRefreshToken(user.userId, refreshTokenHash, expiresAt);

    return { user, accessToken, refreshToken };
  }

  async login(credentials: { emailOrUsername: string; password: string }): Promise<{ user: User; accessToken: string; refreshToken: string }> {
    let user: User | null = null;
    if (credentials.emailOrUsername.includes('@')) {
      user = await this.userRepo.findByEmail(credentials.emailOrUsername);
    } else {
      user = await this.userRepo.findByUsername(credentials.emailOrUsername);
    }

    if (!user || !user.passwordHash) {
      throw { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid username/email or password' };
    }

    const isValid = await comparePassword(credentials.password, user.passwordHash);
    if (!isValid) {
      throw { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid username/email or password' };
    }

    const safeUser = { ...user };
    delete safeUser.passwordHash;

    const accessToken = generateAccessToken({
      userId: safeUser.userId,
      username: safeUser.username,
      email: safeUser.email
    });

    const refreshToken = generateRefreshToken();
    const refreshTokenHash = hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_TTL_DAYS);

    await this.authRepo.saveRefreshToken(safeUser.userId, refreshTokenHash, expiresAt);

    return { user: safeUser, accessToken, refreshToken };
  }

  async refreshTokens(rawRefreshToken: string): Promise<{ accessToken: string; newRefreshToken: string }> {
    const tokenHash = hashToken(rawRefreshToken);
    const tokenRecord = await this.authRepo.findRefreshToken(tokenHash);

    if (!tokenRecord || tokenRecord.revokedAt || new Date() > new Date(tokenRecord.expiresAt)) {
      // Fallback: Check if rawRefreshToken is a valid access token
      const decodedPayload = verifyAccessToken(rawRefreshToken);
      if (decodedPayload) {
        const user = await this.userRepo.findById(decodedPayload.userId);
        if (user) {
          const newAccessToken = generateAccessToken({
            userId: user.userId,
            username: user.username,
            email: user.email
          });
          const newRefreshToken = generateRefreshToken();
          const newRefreshTokenHash = hashToken(newRefreshToken);
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_TTL_DAYS);
          await this.authRepo.saveRefreshToken(user.userId, newRefreshTokenHash, expiresAt);
          return { accessToken: newAccessToken, newRefreshToken };
        }
      }
      throw { statusCode: 401, code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token is invalid or expired' };
    }

    // Revoke previous token (token rotation)
    await this.authRepo.revokeRefreshToken(tokenHash);

    const user = await this.userRepo.findById(tokenRecord.userId);
    if (!user) {
      throw { statusCode: 401, code: 'USER_NOT_FOUND', message: 'User associated with token no longer exists' };
    }

    const newAccessToken = generateAccessToken({
      userId: user.userId,
      username: user.username,
      email: user.email
    });

    const newRefreshToken = generateRefreshToken();
    const newRefreshTokenHash = hashToken(newRefreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_TTL_DAYS);

    await this.authRepo.saveRefreshToken(user.userId, newRefreshTokenHash, expiresAt);

    return { accessToken: newAccessToken, newRefreshToken };
  }

  async logout(rawRefreshToken?: string): Promise<void> {
    if (rawRefreshToken) {
      const tokenHash = hashToken(rawRefreshToken);
      await this.authRepo.revokeRefreshToken(tokenHash);
    }
  }
}
