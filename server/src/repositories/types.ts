import { User, Post, Comment, Notification, Story, Reel, Message, PaginatedResult } from '../types/index.js';

export interface IUserRepository {
  createUser(user: {
    username: string;
    email: string;
    passwordHash: string;
    displayName: string;
    bio?: string;
    location?: string;
    websiteUrl?: string;
  }): Promise<User>;
  findByUsername(username: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findCredentialById(userId: number): Promise<{ userId: number; passwordHash: string } | null>;
  findById(userId: number, currentUserId?: number): Promise<User | null>;
  updateUser(userId: number, updates: {
    displayName?: string;
    bio?: string;
    profileImageUrl?: string;
    coverImageUrl?: string;
    location?: string;
    websiteUrl?: string;
  }): Promise<User>;
  searchUsers(query: string, currentUserId?: number, limit?: number): Promise<User[]>;
  getSuggestions(currentUserId: number, limit?: number): Promise<User[]>;
  followUser(followerId: number, followingId: number): Promise<void>;
  unfollowUser(followerId: number, followingId: number): Promise<void>;
  isFollowing(followerId: number, followingId: number): Promise<boolean>;
  getFollowers(userId: number, currentUserId?: number): Promise<User[]>;
  getFollowing(userId: number, currentUserId?: number): Promise<User[]>;
}

export interface IPostRepository {
  createPost(post: {
    userId: number;
    content?: string;
    imageUrl?: string;
  }): Promise<Post>;
  findById(postId: number, currentUserId?: number): Promise<Post | null>;
  updatePost?(postId: number, data: { content?: string }): Promise<Post>;
  deletePost(postId: number, userId: number): Promise<boolean>;
  getGlobalFeed(currentUserId?: number, cursor?: number, limit?: number): Promise<PaginatedResult<Post>>;
  getFollowingFeed(userId: number, cursor?: number, limit?: number): Promise<PaginatedResult<Post>>;
  getUserPosts(userId: number, currentUserId?: number, cursor?: number, limit?: number): Promise<PaginatedResult<Post>>;
  likePost(userId: number, postId: number): Promise<void>;
  unlikePost(userId: number, postId: number): Promise<void>;
  bookmarkPost(userId: number, postId: number): Promise<void>;
  unbookmarkPost(userId: number, postId: number): Promise<void>;
  getUserBookmarks(userId: number, cursor?: number, limit?: number): Promise<PaginatedResult<Post>>;
}

export interface ICommentRepository {
  createComment(comment: {
    postId: number;
    userId: number;
    content: string;
  }): Promise<Comment>;
  getPostComments(postId: number, cursor?: number, limit?: number): Promise<PaginatedResult<Comment>>;
  deleteComment(commentId: number, userId: number): Promise<boolean>;
}

export interface INotificationRepository {
  createNotification(notif: {
    recipientUserId: number;
    actorUserId: number;
    type: 'LIKE' | 'COMMENT' | 'FOLLOW';
    postId?: number;
  }): Promise<Notification>;
  getUserNotifications(userId: number, cursor?: number, limit?: number): Promise<PaginatedResult<Notification>>;
  getUnreadCount(userId: number): Promise<number>;
  markAsRead(notificationId: number, userId: number): Promise<boolean>;
  markAllAsRead(userId: number): Promise<void>;
}

export interface IStoryRepository {
  createStory(story: { userId: number; mediaUrl: string; caption?: string }): Promise<Story>;
  getFeedStories(userId?: number): Promise<Story[]>;
  deleteStory(storyId: number, userId: number): Promise<boolean>;
}

export interface IReelRepository {
  createReel(reel: { userId: number; videoUrl: string; caption?: string }): Promise<Reel>;
  getReels(currentUserId?: number): Promise<Reel[]>;
  likeReel(userId: number, reelId: number): Promise<void>;
  unlikeReel(userId: number, reelId: number): Promise<void>;
  deleteReel?(reelId: number, userId: number): Promise<boolean>;
}

export interface IMessageRepository {
  sendMessage(msg: { senderId: number; receiverId: number; content: string }): Promise<Message>;
  getMessagesBetweenUsers(userA: number, userB: number): Promise<Message[]>;
  markMessageAsRead(messageId: number, receiverUserId: number): Promise<{ rowsAffected: number; readAt: Date | null; senderId: number | null }>;
}

export interface IAuthRepository {
  saveRefreshToken(userId: number, tokenHash: string, expiresAt: Date): Promise<void>;
  findRefreshToken(tokenHash: string): Promise<{ userId: number; revokedAt: Date | null; expiresAt: Date } | null>;
  revokeRefreshToken(tokenHash: string): Promise<void>;
  revokeAllUserTokens(userId: number): Promise<void>;
}

export interface ISecurityRepository {
  getSecuritySettings(userId: number): Promise<{
    emailVerifiedAt: Date | null;
    mfaEnabled: boolean;
    totpSecretCiphertext?: string;
    passwordChangedAt?: Date;
    lastProtectionCheckAt?: Date;
  } | null>;
  updateSecuritySettings(userId: number, updates: {
    mfaEnabled?: boolean;
    totpSecretCiphertext?: string;
    emailVerifiedAt?: Date;
    passwordChangedAt?: Date;
  }): Promise<void>;
  createSession(session: {
    sessionId: string;
    userId: number;
    refreshTokenHash: string;
    tokenFamilyId: string;
    deviceName: string;
    userAgentSummary: string;
    ipHash?: string;
    expiresAt: Date;
  }): Promise<void>;
  getUserSessions(userId: number): Promise<Array<{
    sessionId: string;
    deviceName: string;
    lastSeenAt: Date;
    isCurrent?: boolean;
  }>>;
  revokeSession(sessionId: string, userId: number): Promise<boolean>;
  revokeOtherSessions(userId: number, currentSessionId: string): Promise<void>;
  logSecurityEvent(event: {
    userId: number;
    sessionId?: string;
    eventType: string;
    outcome: 'SUCCESS' | 'FAILURE';
    deviceSummary?: string;
  }): Promise<void>;
}

export interface IRepositoryManager {
  userRepo: IUserRepository;
  postRepo: IPostRepository;
  commentRepo: ICommentRepository;
  notificationRepo: INotificationRepository;
  storyRepo: IStoryRepository;
  reelRepo: IReelRepository;
  messageRepo: IMessageRepository;
  authRepo: IAuthRepository;
  securityRepo: ISecurityRepository;
}

