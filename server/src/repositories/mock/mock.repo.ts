import bcrypt from 'bcryptjs';
import { User, Post, Comment, Notification, Story, Reel, Message, PaginatedResult } from '../../types/index.js';
import {
  IRepositoryManager,
  IUserRepository,
  IPostRepository,
  ICommentRepository,
  INotificationRepository,
  IStoryRepository,
  IReelRepository,
  IMessageRepository,
  IAuthRepository,
  ISecurityRepository
} from '../types.js';

// Pre-seeded permanent master profiles
let mockUsers: User[] = [
  {
    userId: 100,
    username: 'doom_yash',
    email: 'doom_yash@nexa.app',
    displayName: 'yash',
    bio: 'Doom Magical Orb Master • Creator of Nexa Social Platform',
    location: 'Global',
    websiteUrl: 'https://nexa-social-app.surge.sh',
    profileImageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=doom_yash',
    coverImageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80',
    followersCount: 150,
    followingCount: 25,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    userId: 101,
    username: 'alex',
    email: 'alex@nexa.app',
    displayName: 'Alex Rivera',
    bio: 'Nexa Platform Lead',
    profileImageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex',
    followersCount: 50,
    followingCount: 20,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    userId: 2,
    username: 'sarah_design',
    email: 'sarah@nexa.app',
    displayName: 'Sarah Chen',
    bio: 'UI/UX Designer',
    profileImageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sarah_design',
    followersCount: 80,
    followingCount: 15,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

let mockCredentials: Map<number, string> = new Map([
  [100, bcrypt.hashSync('Leon$yash5', 10)],
  [101, bcrypt.hashSync('Password123!', 10)],
  [2, bcrypt.hashSync('Password123!', 10)]
]);

let mockPosts: Post[] = [
  {
    postId: 1001,
    userId: 100,
    author: {
      userId: 100,
      username: 'doom_yash',
      displayName: 'yash',
      profileImageUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=doom_yash'
    },
    content: 'Welcome to Nexa Social! Dr. Doom Magical Orb power activated. 🔮⚡',
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    likesCount: 24,
    commentsCount: 5,
    isLiked: true,
    isBookmarked: true
  }
];

let mockComments: Comment[] = [];
let mockStories: Story[] = [];
let mockReels: Reel[] = [];
let mockMessages: Message[] = [];
let mockNotifications: Notification[] = [];
let mockRefreshTokens: Map<string, { userId: number; expiresAt: Date; revokedAt: Date | null }> = new Map();
let mockPasswordResetTokens: Map<string, { userId: number; expiresAt: Date; usedAt: Date | null }> = new Map();
let mockEmailVerificationTokens: Map<string, { userId: number; expiresAt: Date; usedAt: Date | null }> = new Map();
let mockSecuritySettings: Map<number, { emailVerifiedAt: Date | null; mfaEnabled: boolean; passwordChangedAt?: Date }> = new Map();

let userIdCounter = 100;
let postIdCounter = 1000;

export class MockUserRepository implements IUserRepository {
  async createUser(u: { username: string; email: string; passwordHash: string; displayName: string; bio?: string; location?: string; websiteUrl?: string }): Promise<User> {
    const cleanUsername = u.username.toLowerCase().trim();
    let existing = mockUsers.find(user => user.username.toLowerCase() === cleanUsername);
    if (existing) {
      mockCredentials.set(existing.userId, u.passwordHash);
      return existing;
    }
    const newUser: User = {
      userId: ++userIdCounter,
      username: cleanUsername,
      email: u.email.toLowerCase().trim(),
      displayName: u.displayName || u.username,
      bio: u.bio || 'Nexa Social Member',
      location: u.location || '',
      websiteUrl: u.websiteUrl || '',
      profileImageUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanUsername}`,
      followersCount: 0,
      followingCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    mockUsers.push(newUser);
    mockCredentials.set(newUser.userId, u.passwordHash);
    return newUser;
  }

  async findByUsername(username: string): Promise<User | null> {
    const clean = username.toLowerCase().trim();
    const found = mockUsers.find(u => u.username.toLowerCase() === clean);
    return found || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const clean = email.toLowerCase().trim();
    const found = mockUsers.find(u => u.email.toLowerCase() === clean || u.username.toLowerCase() === clean);
    return found || null;
  }

  async findCredentialById(userId: number) {
    const hash = mockCredentials.get(userId) || bcrypt.hashSync('Password123!', 10);
    return { userId, passwordHash: hash };
  }

  async findById(userId: number): Promise<User | null> {
    return mockUsers.find(u => u.userId === userId) || null;
  }

  async updateUser(userId: number, updates: any): Promise<User> {
    const user = mockUsers.find(u => u.userId === userId) || mockUsers[0];
    Object.assign(user, updates, { updatedAt: new Date().toISOString() });
    return user;
  }

  async searchUsers(query: string): Promise<User[]> {
    const q = query.toLowerCase();
    return mockUsers.filter(u => u.username.includes(q) || u.displayName.toLowerCase().includes(q));
  }

  async getSuggestions(currentUserId?: number): Promise<User[]> {
    return currentUserId ? mockUsers.filter(u => u.userId !== currentUserId) : mockUsers;
  }

  async followUser(): Promise<void> {}
  async unfollowUser(): Promise<void> {}
  async isFollowing(): Promise<boolean> { return false; }
  async getFollowers(): Promise<User[]> { return mockUsers; }
  async getFollowing(): Promise<User[]> { return mockUsers; }

  async updateLockoutState(
    userId: number,
    failedLoginAttempts: number,
    firstFailedAttemptAt: Date | null,
    lockoutUntil: Date | null
  ): Promise<void> {
    const user = mockUsers.find(u => u.userId === userId);
    if (user) {
      user.failedLoginAttempts = failedLoginAttempts;
      user.firstFailedAttemptAt = firstFailedAttemptAt ? firstFailedAttemptAt.toISOString() : null;
      user.lockoutUntil = lockoutUntil ? lockoutUntil.toISOString() : null;
    }
  }

  async resetLockoutState(userId: number): Promise<void> {
    const user = mockUsers.find(u => u.userId === userId);
    if (user) {
      user.failedLoginAttempts = 0;
      user.firstFailedAttemptAt = null;
      user.lockoutUntil = null;
    }
  }
}

export class MockPostRepository implements IPostRepository {
  async createPost(p: { userId: number; content?: string; imageUrl?: string }): Promise<Post> {
    const author = mockUsers.find(u => u.userId === p.userId) || mockUsers[0];
    const newPost: Post = {
      postId: ++postIdCounter,
      userId: p.userId,
      author: {
        userId: author.userId,
        username: author.username,
        displayName: author.displayName,
        profileImageUrl: author.profileImageUrl
      },
      content: p.content,
      imageUrl: p.imageUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      likesCount: 0,
      commentsCount: 0,
      isLiked: false,
      isBookmarked: false
    };
    mockPosts.unshift(newPost);
    return newPost;
  }

  async findById(postId: number): Promise<Post | null> {
    return mockPosts.find(p => p.postId === postId) || mockPosts[0];
  }

  async updatePost(postId: number, data: { content?: string }): Promise<Post> {
    const post = mockPosts.find(p => p.postId === postId) || mockPosts[0];
    if (data.content !== undefined) post.content = data.content;
    post.updatedAt = new Date().toISOString();
    return post;
  }

  async deletePost(postId: number, userId?: number): Promise<boolean> {
    const post = mockPosts.find(p => p.postId === postId);
    if (!post) return false;
    if (userId && post.userId !== userId) return false;
    mockPosts = mockPosts.filter(p => p.postId !== postId);
    return true;
  }

  async getGlobalFeed(): Promise<PaginatedResult<Post>> {
    return { data: mockPosts, nextCursor: null, hasMore: false };
  }

  async getFollowingFeed(): Promise<PaginatedResult<Post>> {
    return { data: mockPosts, nextCursor: null, hasMore: false };
  }

  async getUserPosts(userId: number): Promise<PaginatedResult<Post>> {
    const posts = mockPosts.filter(p => p.userId === userId);
    return { data: posts.length > 0 ? posts : mockPosts, nextCursor: null, hasMore: false };
  }

  async likePost(): Promise<void> {}
  async unlikePost(): Promise<void> {}
  async bookmarkPost(): Promise<void> {}
  async unbookmarkPost(): Promise<void> {}
  async getUserBookmarks(): Promise<PaginatedResult<Post>> { return { data: mockPosts, nextCursor: null, hasMore: false }; }
}

export class MockCommentRepository implements ICommentRepository {
  async createComment(c: { postId: number; userId: number; content: string }): Promise<Comment> {
    const author = mockUsers.find(u => u.userId === c.userId) || mockUsers[0];
    const newComment: Comment = {
      commentId: Date.now(),
      postId: c.postId,
      userId: c.userId,
      author: {
        userId: author.userId,
        username: author.username,
        displayName: author.displayName,
        profileImageUrl: author.profileImageUrl
      },
      content: c.content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    mockComments.push(newComment);
    return newComment;
  }
  async getPostComments(): Promise<any> { return { data: mockComments, nextCursor: null, hasMore: false }; }
  async deleteComment(): Promise<boolean> { return true; }
}

export class MockNotificationRepository implements INotificationRepository {
  async createNotification(notif: any): Promise<any> { return {}; }
  async getUserNotifications(): Promise<any> { return { data: [], nextCursor: null, hasMore: false }; }
  async getUnreadCount(): Promise<number> { return 0; }
  async markAsRead(notificationId: number, userId: number): Promise<boolean> {
    const notif = mockNotifications.find(n => n.notificationId === notificationId && n.recipientUserId === userId);
    if (!notif) return false;
    notif.isRead = true;
    return true;
  }
  async markAllAsRead(): Promise<void> {}
}

export class MockStoryRepository implements IStoryRepository {
  async createStory(): Promise<any> { return {}; }
  async getFeedStories(): Promise<any> { return []; }
  async deleteStory(): Promise<boolean> { return true; }
}

export class MockReelRepository implements IReelRepository {
  async createReel(r: any): Promise<Reel> {
    const author = mockUsers.find(u => u.userId === r.userId) || mockUsers[0];
    const reel: Reel = {
      reelId: ++postIdCounter,
      userId: r.userId,
      author: { userId: author.userId, username: author.username, displayName: author.displayName },
      videoUrl: r.videoUrl,
      caption: r.caption,
      likesCount: 5,
      isLiked: true,
      createdAt: new Date().toISOString()
    };
    mockReels.unshift(reel);
    return reel;
  }

  async getReels(): Promise<Reel[]> { return mockReels; }
  async likeReel(): Promise<void> {}
  async unlikeReel(): Promise<void> {}
  async deleteReel(reelId: number, userId: number): Promise<boolean> {
    const reel = mockReels.find(r => r.reelId === reelId);
    if (!reel) return false;
    if (reel.userId !== userId) return false;
    mockReels = mockReels.filter(r => r.reelId !== reelId);
    return true;
  }
}

export class MockMessageRepository implements IMessageRepository {
  async sendMessage(): Promise<any> { return {}; }
  async getMessagesBetweenUsers(): Promise<any> { return []; }
  async markMessageAsRead(): Promise<any> { return { rowsAffected: 1, readAt: new Date(), senderId: null }; }
}

export class MockAuthRepository implements IAuthRepository {
  async saveRefreshToken(userId: number, tokenHash: string, expiresAt: Date): Promise<void> {
    mockRefreshTokens.set(tokenHash, { userId, expiresAt, revokedAt: null });
  }
  async findRefreshToken(tokenHash: string): Promise<{ userId: number; revokedAt: Date | null; expiresAt: Date } | null> {
    const record = mockRefreshTokens.get(tokenHash);
    if (!record) return null;
    return { userId: record.userId, revokedAt: record.revokedAt, expiresAt: record.expiresAt };
  }
  async revokeRefreshToken(tokenHash: string): Promise<void> {
    const record = mockRefreshTokens.get(tokenHash);
    if (record) {
      record.revokedAt = new Date();
    }
  }
  async revokeAllUserRefreshTokens(userId: number): Promise<void> {
    for (const [, record] of mockRefreshTokens.entries()) {
      if (record.userId === userId && !record.revokedAt) {
        record.revokedAt = new Date();
      }
    }
  }
  async revokeAllUserTokens(userId: number): Promise<void> {
    await this.revokeAllUserRefreshTokens(userId);
  }
  async savePasswordResetToken(userId: number, tokenHash: string, expiresAt: Date): Promise<void> {
    mockPasswordResetTokens.set(tokenHash, { userId, expiresAt, usedAt: null });
  }
  async findPasswordResetToken(tokenHash: string): Promise<{ userId: number; expiresAt: Date; usedAt: Date | null } | null> {
    const record = mockPasswordResetTokens.get(tokenHash);
    if (!record) return null;
    return { userId: record.userId, expiresAt: record.expiresAt, usedAt: record.usedAt };
  }
  async markPasswordResetTokenUsed(tokenHash: string): Promise<void> {
    const record = mockPasswordResetTokens.get(tokenHash);
    if (record) {
      record.usedAt = new Date();
    }
  }
  async saveEmailVerificationToken(userId: number, tokenHash: string, expiresAt: Date): Promise<void> {
    mockEmailVerificationTokens.set(tokenHash, { userId, expiresAt, usedAt: null });
  }
  async findEmailVerificationToken(tokenHash: string): Promise<{ userId: number; expiresAt: Date; usedAt: Date | null } | null> {
    const record = mockEmailVerificationTokens.get(tokenHash);
    if (!record) return null;
    return { userId: record.userId, expiresAt: record.expiresAt, usedAt: record.usedAt };
  }
  async markEmailVerificationTokenUsed(tokenHash: string): Promise<void> {
    const record = mockEmailVerificationTokens.get(tokenHash);
    if (record) {
      record.usedAt = new Date();
    }
  }
}

export class MockSecurityRepository implements ISecurityRepository {
  async getSecuritySettings(userId: number): Promise<any> {
    const settings = mockSecuritySettings.get(userId);
    if (!settings) return { emailVerifiedAt: null, mfaEnabled: false, lastProtectionCheckAt: new Date() };
    return { ...settings, lastProtectionCheckAt: new Date() };
  }
  async updateSecuritySettings(userId: number, updates: any): Promise<void> {
    const current = mockSecuritySettings.get(userId) || { emailVerifiedAt: null, mfaEnabled: false };
    if (updates.emailVerifiedAt !== undefined) current.emailVerifiedAt = updates.emailVerifiedAt;
    if (updates.mfaEnabled !== undefined) current.mfaEnabled = updates.mfaEnabled;
    if (updates.passwordChangedAt !== undefined) current.passwordChangedAt = updates.passwordChangedAt;
    mockSecuritySettings.set(userId, current);
  }
  async createSession(): Promise<void> {}
  async getSessions(): Promise<any[]> { return []; }
  async getUserSessions(): Promise<any[]> { return []; }
  async revokeSession(): Promise<boolean> { return true; }
  async revokeOtherSessions(): Promise<void> {}
  async logSecurityEvent(): Promise<void> {}
}

export const mockRepositoryManager: IRepositoryManager = {
  userRepo: new MockUserRepository(),
  postRepo: new MockPostRepository(),
  commentRepo: new MockCommentRepository(),
  notificationRepo: new MockNotificationRepository(),
  storyRepo: new MockStoryRepository(),
  reelRepo: new MockReelRepository(),
  messageRepo: new MockMessageRepository(),
  authRepo: new MockAuthRepository(),
  securityRepo: new MockSecurityRepository(),
  get users() { return this.userRepo; },
  get posts() { return this.postRepo; },
  get comments() { return this.commentRepo; },
  get notifications() { return this.notificationRepo; },
  get stories() { return this.storyRepo; },
  get reels() { return this.reelRepo; },
  get messages() { return this.messageRepo; },
  get auth() { return this.authRepo; },
  get security() { return this.securityRepo; }
};
