import { Request } from 'express';

export interface User {
  userId: number;
  username: string;
  email: string;
  passwordHash?: string;
  displayName: string;
  bio?: string | null;
  profileImageUrl?: string | null;
  coverImageUrl?: string | null;
  location?: string | null;
  websiteUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  followersCount?: number;
  followingCount?: number;
  isFollowing?: boolean;
  isPrivate?: boolean;
  role?: 'ADMIN' | 'MODERATOR' | 'USER';
  failedLoginAttempts?: number;
  firstFailedAttemptAt?: string | null;
  lockoutUntil?: string | null;
}

export interface Post {
  postId: number;
  userId: number;
  author: {
    userId: number;
    username: string;
    displayName: string;
    profileImageUrl?: string | null;
  };
  content?: string | null;
  imageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  likesCount: number;
  commentsCount: number;
  isLiked?: boolean;
  isBookmarked?: boolean;
  isMock?: boolean;
}

export interface Comment {
  commentId: number;
  postId: number;
  userId: number;
  author: {
    userId: number;
    username: string;
    displayName: string;
    profileImageUrl?: string | null;
  };
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  notificationId: number;
  recipientUserId: number;
  actorUserId: number;
  actor: {
    userId: number;
    username: string;
    displayName: string;
    profileImageUrl?: string | null;
  };
  type: 'LIKE' | 'COMMENT' | 'FOLLOW';
  postId?: number | null;
  isRead: boolean;
  createdAt: string;
}

export interface Story {
  storyId: number;
  userId: number;
  author: {
    userId: number;
    username: string;
    displayName: string;
    profileImageUrl?: string | null;
  };
  mediaUrl: string;
  caption?: string | null;
  musicTrackId?: string | null;
  createdAt: string;
  expiresAt: string;
}

export interface Reel {
  reelId: number;
  userId: number;
  author: {
    userId: number;
    username: string;
    displayName: string;
    profileImageUrl?: string | null;
  };
  videoUrl: string;
  caption?: string | null;
  likesCount: number;
  isLiked?: boolean;
  isMock?: boolean;
  createdAt: string;
}

export interface Message {
  messageId: number;
  senderId?: number | null;
  receiverId: number;
  sender: {
    userId: number;
    username: string;
    displayName: string;
    profileImageUrl?: string | null;
  };
  content: string;
  isRead: boolean;
  isUnsent?: boolean;
  senderType?: 'user' | 'ai';
  aiAgent?: string;
  triggerMessageId?: number | null;
  attachments?: any[];
  createdAt: string;
}

export interface ConversationSummary {
  otherUserId: number;
  username: string;
  displayName: string;
  profileImageUrl?: string | null;
  lastMessage: string;
  lastMessageAt: string | null;
  unreadCount: number;
}

export interface Group {
  groupId: number;
  name: string;
  description?: string | null;
  createdBy: number;
  avatarUrl?: string | null;
  createdAt: string;
  membersCount?: number;
  lastMessage?: string | null;
  onlyAdminsCanPost?: boolean;
}

export interface GroupMember {
  groupId: number;
  userId: number;
  role: 'ADMIN' | 'MEMBER';
  joinedAt: string;
  user?: {
    userId: number;
    username: string;
    displayName: string;
    profileImageUrl?: string | null;
  };
}

export interface GroupMessage {
  messageId: number;
  groupId: number;
  senderId?: number | null;
  sender: {
    userId: number;
    username: string;
    displayName: string;
    profileImageUrl?: string | null;
  };
  content: string;
  senderType?: 'user' | 'ai';
  aiAgent?: string;
  triggerMessageId?: number | null;
  attachments?: any[];
  createdAt: string;
}

export interface CreateGroupParams {
  name: string;
  description?: string;
  avatarUrl?: string;
  createdBy: number;
  memberIds?: number[];
  onlyAdminsCanPost?: boolean;
}

export interface Broadcast {
  broadcastId: number;
  senderId: number;
  title?: string | null;
  content: string;
  recipientsCount: number;
  recipientIds: number[];
  attachments?: any[];
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    username: string;
    email?: string;
    role?: 'ADMIN' | 'MODERATOR' | 'USER';
  };
}

export interface UserPrivacySettings {
  userId: number;
  isPrivate: boolean;
  whoCanMessage: 'EVERYONE' | 'FOLLOWING' | 'NOBODY';
  whoCanComment: 'EVERYONE' | 'FOLLOWING' | 'NOBODY';
  activityStatusVisible: boolean;
  readReceiptsEnabled: boolean;
  hideLikeCounts: boolean;
  updatedAt: string;
}

export interface UserBlock {
  blockId: number;
  blockerUserId: number;
  blockedUserId: number;
  blockedUser?: {
    userId: number;
    username: string;
    displayName: string;
    profileImageUrl?: string | null;
  };
  createdAt: string;
}

export interface FollowRequest {
  requestId: number;
  requesterUserId: number;
  targetUserId: number;
  requester: {
    userId: number;
    username: string;
    displayName: string;
    profileImageUrl?: string | null;
  };
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
}

export interface UserReport {
  reportId: number;
  reporterUserId: number;
  targetType: 'USER' | 'POST' | 'COMMENT' | 'STORY' | 'REEL' | 'MESSAGE';
  targetId: number;
  reason: string;
  details?: string | null;
  status: 'PENDING' | 'INVESTIGATING' | 'RESOLVED' | 'DISMISSED';
  createdAt: string;
  updatedAt: string;
}

export interface ModerationAction {
  actionId: number;
  reportId?: number | null;
  moderatorUserId: number;
  actionType: 'WARN' | 'HIDE_CONTENT' | 'DELETE_CONTENT' | 'SUSPEND_USER' | 'BAN_USER' | 'DISMISS_REPORT';
  targetType: string;
  targetId: number;
  notes?: string | null;
  createdAt: string;
}

export interface CursorPaginationOptions {
  cursor?: string | number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  nextCursor?: string | number | null;
  hasMore: boolean;
}
