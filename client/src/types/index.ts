export interface User {
  userId: number;
  username: string;
  email: string;
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
  isUnsent?: boolean;
  createdAt: string;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  meta?: {
    nextCursor?: string | number | null;
    hasMore?: boolean;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: any[];
  };
}
