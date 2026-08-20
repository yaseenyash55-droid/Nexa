import { getUserRepository, getNotificationRepository } from '../repositories/factory.js';
import { User } from '../types/index.js';

import fs from 'fs';
import path from 'path';

function saveBase64ImageToDisk(base64Data: string, prefix: string, userId: number): string {
  if (!base64Data || !base64Data.startsWith('data:image/')) {
    return base64Data;
  }
  const matches = base64Data.match(/^data:image\/([a-zA-Z0-9+/]+);base64,(.+)$/);
  if (!matches) return base64Data;

  const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
  const buffer = Buffer.from(matches[2], 'base64');

  const uploadDir = path.join(process.cwd(), 'uploads', 'avatars');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const filename = `${prefix}-${userId}-${Date.now()}.${ext}`;
  const filePath = path.join(uploadDir, filename);
  fs.writeFileSync(filePath, buffer);

  return `/uploads/avatars/${filename}`;
}

export class UserService {
  private toPublicUser(user: User): User {
    const { email: _email, passwordHash: _passwordHash, ...publicUser } = user;
    return publicUser as User;
  }

  private get userRepo() {
    return getUserRepository();
  }

  private get notifRepo() {
    return getNotificationRepository();
  }

  async getUserById(userId: number, currentUserId?: number): Promise<User> {
    const user = await this.userRepo.findById(userId, currentUserId);
    if (!user) {
      throw { statusCode: 404, code: 'USER_NOT_FOUND', message: 'User not found' };
    }
    return this.toPublicUser(user);
  }

  async getUserByUsername(username: string, currentUserId?: number): Promise<User> {
    const user = await this.userRepo.findByUsername(username);
    if (!user) {
      throw { statusCode: 404, code: 'USER_NOT_FOUND', message: 'User not found' };
    }
    if (currentUserId) {
      user.isFollowing = await this.userRepo.isFollowing(currentUserId, user.userId);
    }
    return this.toPublicUser(user);
  }

  async updateProfile(userId: number, updates: {
    displayName?: string;
    bio?: string;
    profileImageUrl?: string;
    coverImageUrl?: string;
    location?: string;
    websiteUrl?: string;
  }): Promise<User> {
    if (updates.profileImageUrl && updates.profileImageUrl.startsWith('data:image/')) {
      updates.profileImageUrl = saveBase64ImageToDisk(updates.profileImageUrl, 'avatar', userId);
    }
    if (updates.coverImageUrl && updates.coverImageUrl.startsWith('data:image/')) {
      updates.coverImageUrl = saveBase64ImageToDisk(updates.coverImageUrl, 'cover', userId);
    }

    const user = await this.userRepo.updateUser(userId, updates);
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser as User;
  }

  async searchUsers(query: string, currentUserId?: number, limit = 10): Promise<User[]> {
    if (!query || !query.trim()) return [];
    const users = await this.userRepo.searchUsers(query, currentUserId, limit);
    return users.map((user) => this.toPublicUser(user));
  }

  async getSuggestions(currentUserId: number, limit = 5): Promise<User[]> {
    const users = await this.userRepo.getSuggestions(currentUserId, limit);
    return users.map((user) => this.toPublicUser(user));
  }

  async followUser(followerId: number, followingId: number): Promise<void> {
    if (followerId === followingId) {
      throw { statusCode: 400, code: 'CANNOT_FOLLOW_SELF', message: 'You cannot follow yourself' };
    }

    const targetUser = await this.userRepo.findById(followingId);
    if (!targetUser) {
      throw { statusCode: 404, code: 'USER_NOT_FOUND', message: 'User to follow does not exist' };
    }

    await this.userRepo.followUser(followerId, followingId);

    // Create follow notification
    try {
      await this.notifRepo.createNotification({
        recipientUserId: followingId,
        actorUserId: followerId,
        type: 'FOLLOW'
      });
    } catch {
      // Ignore notification errors
    }
  }

  async unfollowUser(followerId: number, followingId: number): Promise<void> {
    await this.userRepo.unfollowUser(followerId, followingId);
  }

  async getFollowers(userId: number, currentUserId?: number): Promise<User[]> {
    const users = await this.userRepo.getFollowers(userId, currentUserId);
    return users.map((user) => this.toPublicUser(user));
  }

  async getFollowing(userId: number, currentUserId?: number): Promise<User[]> {
    const users = await this.userRepo.getFollowing(userId, currentUserId);
    return users.map((user) => this.toPublicUser(user));
  }
}
