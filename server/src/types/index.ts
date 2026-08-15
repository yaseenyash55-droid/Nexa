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
  createdAt: string;
}

export interface Message {
  messageId: number;
  senderId: number;
  receiverId: number;
  sender: {
    userId: number;
    username: string;
    displayName: string;
    profileImageUrl?: string | null;
  };
  content: string;
  isRead: boolean;
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
  };
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
