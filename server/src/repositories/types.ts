import { User, Post, Comment, Notification, Story, Reel, Message, GroupMessage, ConversationSummary, PaginatedResult, MessageReaction, ReactionSummary } from '../types/index.js';

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
  createUserOnConnection?(conn: any, user: {
    username: string;
    email: string;
    passwordHash: string;
    displayName: string;
    bio?: string;
    location?: string;
    websiteUrl?: string;
  }): Promise<User>;
  findByIdOnConnection?(conn: any, userId: number): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findCredentialById(userId: number): Promise<{ userId: number; passwordHash: string } | null>;
  updatePasswordHash(userId: number, passwordHash: string): Promise<void>;
  findById(userId: number, currentUserId?: number): Promise<User | null>;
  updateUser(userId: number, updates: {
    username?: string;
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
  updateLockoutState(userId: number, failedLoginAttempts: number, firstFailedAttemptAt: Date | null, lockoutUntil: Date | null): Promise<void>;
  resetLockoutState(userId: number): Promise<void>;
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
  createStory(story: { userId: number; mediaUrl: string; caption?: string; musicTrackId?: string }): Promise<Story>;
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
  sendMessage(msg: { senderId: number; receiverId: number; content: string; attachments?: any[]; replyToMessageId?: number | null }): Promise<Message>;
  sendAiMessage(msg: { receiverId: number; content: string; aiAgent?: string; triggerMessageId?: number | null; attachments?: any[] }): Promise<Message>;
  findAiResponseByTrigger?(triggerKey: string | number, aiAgent?: string): Promise<Message | null>;
  getMessagesBetweenUsers(userA: number, userB: number): Promise<Message[]>;
  getMessageParticipants(messageId: number): Promise<{ senderId: number | null; receiverId: number } | null>;
  markMessageAsRead(messageId: number, receiverUserId: number): Promise<{ rowsAffected: number; readAt: Date | null; senderId: number | null }>;
  getConversations(userId: number): Promise<ConversationSummary[]>;
  unsendMessage(messageId: number, senderId: number): Promise<{ success: boolean; receiverId: number }>;
  editMessage(messageId: number, senderId: number, content: string): Promise<{ success: boolean; editedAt: Date | string }>;
  upsertReaction(messageId: number, userId: number, reaction: string): Promise<{ reactionId: number; updatedAt: string }>;
  removeReaction(messageId: number, userId: number): Promise<{ success: boolean }>;
  getReactions(messageId: number, viewerUserId?: number): Promise<ReactionSummary[]>;
}

export interface IAuthRepository {
  saveRefreshToken(userId: number, tokenHash: string, expiresAt: Date): Promise<void>;
  saveRefreshTokenOnConnection?(conn: any, userId: number, tokenHash: string, expiresAt: Date): Promise<void>;
  findRefreshToken(tokenHash: string): Promise<{ userId: number; revokedAt: Date | null; expiresAt: Date } | null>;
  revokeRefreshToken(tokenHash: string): Promise<void>;
  revokeAllUserTokens(userId: number): Promise<void>;
  savePasswordResetToken(userId: number, tokenHash: string, expiresAt: Date): Promise<void>;
  findPasswordResetToken(tokenHash: string): Promise<{ userId: number; expiresAt: Date; usedAt: Date | null } | null>;
  markPasswordResetTokenUsed(tokenHash: string): Promise<void>;
  saveEmailVerificationToken(userId: number, tokenHash: string, expiresAt: Date): Promise<void>;
  findEmailVerificationToken(tokenHash: string): Promise<{ userId: number; expiresAt: Date; usedAt: Date | null } | null>;
  markEmailVerificationTokenUsed(tokenHash: string): Promise<void>;
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

export interface IFcmTokenRepository {
  upsertToken(userId: number, token: string, platform?: string, deviceId?: string): Promise<void>;
  revokeToken(token: string, userId?: number): Promise<boolean>;
  revokeUserTokens(userId: number): Promise<number>;
  getUserTokens(userId: number): Promise<string[]>;
}

export interface IPrivacyRepository {
  getPrivacySettings(userId: number): Promise<any>;
  updatePrivacySettings(userId: number, updates: any): Promise<any>;
  getHiddenWords(userId: number): Promise<string[]>;
  setHiddenWords(userId: number, words: string[]): Promise<string[]>;
  getBlockedUsers(userId: number): Promise<any[]>;
  blockUser(blockerId: number, blockedId: number): Promise<void>;
  unblockUser(blockerId: number, blockedId: number): Promise<void>;
  isBlocked(userA: number, userB: number): Promise<boolean>;
  getPendingFollowRequests(targetUserId: number): Promise<any[]>;
  createFollowRequest(requesterId: number, targetId: number): Promise<{ requestId: number; status: string }>;
  respondToFollowRequest(targetUserId: number, requestId: number, accept: boolean): Promise<boolean>;
  createReport(report: {
    reporterUserId: number;
    targetType: string;
    targetId: number;
    reason: string;
    details?: string;
  }): Promise<{ reportId: number; status: string }>;
  getReports(filter?: { status?: string; targetType?: string }): Promise<any[]>;
  createModerationAction(action: {
    reportId?: number;
    moderatorUserId: number;
    actionType: string;
    targetType: string;
    targetId: number;
    notes?: string;
  }): Promise<{ actionId: number }>;
}

export { IAiRepository, IRagDocumentRepository, IAiMemoryRepository, AiPreference, AiMemory } from '../types/ai.types.js';
import { IAiRepository, IRagDocumentRepository, IAiMemoryRepository } from '../types/ai.types.js';

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
  fcmTokenRepo: IFcmTokenRepository;
  privacyRepo: IPrivacyRepository;
  aiRepo: IAiRepository;
  ragRepo: IRagDocumentRepository;
  memoryRepo: IAiMemoryRepository;
  users: IUserRepository;
  posts: IPostRepository;
  comments: ICommentRepository;
  notifications: INotificationRepository;
  stories: IStoryRepository;
  reels: IReelRepository;
  messages: IMessageRepository;
  auth: IAuthRepository;
  security: ISecurityRepository;
  fcmTokens: IFcmTokenRepository;
  privacy: IPrivacyRepository;
  ai: IAiRepository;
  rag: IRagDocumentRepository;
  memories: IAiMemoryRepository;
}
