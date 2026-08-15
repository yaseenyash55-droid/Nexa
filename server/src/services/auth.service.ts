import { getRepositoryManager } from '../repositories/index.js';
import { hashPassword, comparePassword } from '../utils/hash.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken, verifyAccessToken } from '../utils/jwt.js';
import { AuthTokens, User } from '../types/index.js';

export class AuthService {
  private get userRepo() {
    return getRepositoryManager().userRepo;
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

    const credential = await this.userRepo.findCredentialById(user.userId);
    const passwordHash = credential?.passwordHash || (user as any).passwordHash;
    if (!passwordHash) {
      throw { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid username/email or password' };
    }

    const isMatch = await comparePassword(credentials.password, passwordHash);
    if (!isMatch) {
      throw { statusCode: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid username/email or password' };
    }

    const accessToken = signAccessToken({ userId: user.userId, username: user.username, email: user.email });
    const refreshToken = signRefreshToken({ userId: user.userId, username: user.username, email: user.email });

    return { user, tokens: { accessToken, refreshToken }, accessToken, refreshToken };
  }

  async refreshTokens(refreshToken?: string, authHeaderToken?: string): Promise<AuthTokens & { accessToken: string; newRefreshToken: string }> {
    let payload: { userId: number; username: string; email?: string } | null = null;

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
      } catch {
        payload = null;
      }
    }

    if (!payload) {
      throw { statusCode: 401, code: 'INVALID_REFRESH_TOKEN', message: 'Refresh token is missing or expired' };
    }

    const user = await this.userRepo.findById(payload.userId);
    if (!user) {
      throw { statusCode: 401, code: 'USER_NOT_FOUND', message: 'User associated with token no longer exists' };
    }

    const newAccessToken = signAccessToken({ userId: user.userId, username: user.username, email: user.email });
    const newRefreshToken = signRefreshToken({ userId: user.userId, username: user.username, email: user.email });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken, newRefreshToken };
  }

  async logout(rawRefreshToken?: string): Promise<void> {}
}
