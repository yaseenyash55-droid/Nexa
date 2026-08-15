import bcrypt from 'bcryptjs';
import {
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
import { User, Post, Comment, Notification, Story, Reel, Message, PaginatedResult } from '../../types/index.js';

const defaultPasswordHash = bcrypt.hashSync('Password123!', 10);

export class MockUserRepository implements IUserRepository {
  private users: (User & { passwordHash?: string })[] = [
    { userId: 1, username: 'alex', displayName: 'Alex Rivera', email: 'alex@nexa.app', passwordHash: defaultPasswordHash, followersCount: 10, followingCount: 5, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    { userId: 2, username: 'sarah_design', displayName: 'Sarah Chen', email: 'sarah@nexa.app', passwordHash: defaultPasswordHash, followersCount: 25, followingCount: 12, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
  ];

  async createUser(user: { username: string; email: string; passwordHash: string; displayName: string }): Promise<User> {
    const newUser = {
      userId: this.users.length + 1,
      username: user.username.toLowerCase(),
      displayName: user.displayName,
      email: user.email.toLowerCase(),
      passwordHash: user.passwordHash,
      followersCount: 0,
      followingCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.users.push(newUser);
    return newUser;
  }
  async findByUsername(username: string): Promise<User | null> {
    const u = this.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
    return u ? { followersCount: 0, followingCount: 0, ...u } : null;
  }
  async findByEmail(email: string): Promise<User | null> {
    const u = this.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    return u ? { followersCount: 0, followingCount: 0, ...u } : null;
  }
  async findCredentialById(userId: number): Promise<{ userId: number; passwordHash: string } | null> {
    const u = this.users.find((u) => u.userId === userId);
    return u && u.passwordHash ? { userId: u.userId, passwordHash: u.passwordHash } : null;
  }
  async findById(userId: number): Promise<User | null> {
    const u = this.users.find((u) => u.userId === userId);
    return u ? { followersCount: 0, followingCount: 0, ...u } : null;
  }
  async updateUser(userId: number, updates: Partial<User>): Promise<User> {
    const u = await this.findById(userId);
    if (!u) throw new Error('User not found');
    Object.assign(u, updates);
    return u;
  }
  async searchUsers(query: string): Promise<User[]> {
    const q = query.toLowerCase();
    return this.users.filter((u) => u.username.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q));
  }
  async getSuggestions(currentUserId: number): Promise<User[]> {
    return this.users.filter((u) => u.userId !== currentUserId);
  }
  async followUser(followerId: number, followingId: number): Promise<void> {}
  async unfollowUser(followerId: number, followingId: number): Promise<void> {}
  async isFollowing(followerId: number, followingId: number): Promise<boolean> {
    return false;
  }
  async getFollowers(userId: number): Promise<User[]> {
    return [];
  }
  async getFollowing(userId: number): Promise<User[]> {
    return [];
  }
}

export class MockPostRepository implements IPostRepository {
  private posts: Post[] = [
    {
      postId: 101,
      userId: 1,
      author: { userId: 1, username: 'alex', displayName: 'Alex Rivera' },
      content: 'Sample post',
      imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475',
      likesCount: 5,
      commentsCount: 2,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      postId: 102,
      userId: 2,
      author: { userId: 2, username: 'sarah_design', displayName: 'Sarah Chen' },
      content: 'Sarah post',
      likesCount: 1,
      commentsCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
  private bookmarks: Set<string> = new Set();

  async createPost(post: { userId: number; content?: string; imageUrl?: string }): Promise<Post> {
    const newPost: Post = {
      postId: this.posts.length + 100,
      userId: Number(post.userId),
      author: { userId: Number(post.userId), username: 'alex', displayName: 'Alex Rivera' },
      content: post.content || '',
      imageUrl: post.imageUrl || 'https://images.unsplash.com/photo-1518770660439-4636190af475',
      likesCount: 0,
      commentsCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.posts.unshift(newPost);
    return newPost;
  }
  async findById(postId: number): Promise<Post | null> {
    return this.posts.find((p) => Number(p.postId) === Number(postId)) || null;
  }
  async deletePost(postId: number, userId: number): Promise<boolean> {
    const p = await this.findById(postId);
    if (!p) throw new Error('Post not found');
    if (Number(p.userId) !== Number(userId)) {
      const err: any = new Error('You can only delete your own posts');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }
    this.posts = this.posts.filter((x) => Number(x.postId) !== Number(postId));
    return true;
  }
  async getGlobalFeed(): Promise<PaginatedResult<Post>> {
    return { data: this.posts, hasMore: false };
  }
  async getFollowingFeed(): Promise<PaginatedResult<Post>> {
    return { data: this.posts, hasMore: false };
  }
  async getUserPosts(userId: number): Promise<PaginatedResult<Post>> {
    return { data: this.posts.filter((p) => Number(p.userId) === Number(userId)), hasMore: false };
  }
  async likePost(userId: number, postId: number): Promise<void> {}
  async unlikePost(userId: number, postId: number): Promise<void> {}
  async bookmarkPost(userId: number, postId: number): Promise<void> {
    this.bookmarks.add(`${Number(userId)}_${Number(postId)}`);
  }
  async unbookmarkPost(userId: number, postId: number): Promise<void> {
    this.bookmarks.delete(`${Number(userId)}_${Number(postId)}`);
  }
  async getUserBookmarks(userId: number): Promise<PaginatedResult<Post>> {
    const bookmarked = this.posts.filter((p) => this.bookmarks.has(`${Number(userId)}_${Number(p.postId)}`));
    return { data: bookmarked, hasMore: false };
  }
}

export class MockCommentRepository implements ICommentRepository {
  private comments: Comment[] = [];

  async createComment(comment: { postId: number; userId: number; content: string }): Promise<Comment> {
    const c: Comment = {
      commentId: this.comments.length + 1,
      postId: Number(comment.postId),
      userId: Number(comment.userId),
      author: { userId: Number(comment.userId), username: 'alex', displayName: 'Alex' },
      content: comment.content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.comments.push(c);
    return c;
  }
  async getPostComments(postId: number): Promise<PaginatedResult<Comment>> {
    return { data: this.comments.filter((c) => Number(c.postId) === Number(postId)), hasMore: false };
  }
  async deleteComment(commentId: number, userId: number): Promise<boolean> {
    return true;
  }
}

export class MockNotificationRepository implements INotificationRepository {
  private notifications: Notification[] = [
    {
      notificationId: 1,
      recipientUserId: 1,
      actorUserId: 2,
      actor: { userId: 2, username: 'sarah_design', displayName: 'Sarah Chen' },
      type: 'LIKE',
      postId: 101,
      isRead: false,
      createdAt: new Date().toISOString()
    }
  ];

  async getUserNotifications(userId: number): Promise<PaginatedResult<Notification>> {
    return { data: this.notifications.filter((n) => Number(n.recipientUserId) === Number(userId)), hasMore: false };
  }
  async getUnreadCount(userId: number): Promise<number> {
    return this.notifications.filter((n) => Number(n.recipientUserId) === Number(userId) && !n.isRead).length;
  }
  async markAsRead(notificationId: number, userId: number): Promise<boolean> {
    const n = this.notifications.find((n) => Number(n.notificationId) === Number(notificationId) && Number(n.recipientUserId) === Number(userId));
    if (!n) {
      const err: any = new Error('Notification not found');
      err.statusCode = 404;
      err.code = 'NOTIFICATION_NOT_FOUND';
      throw err;
    }
    n.isRead = true;
    return true;
  }
  async markAllAsRead(userId: number): Promise<void> {
    this.notifications.forEach((n) => {
      if (Number(n.recipientUserId) === Number(userId)) {
        n.isRead = true;
      }
    });
  }
  async createNotification(notif: { recipientUserId: number; actorUserId: number; type: 'LIKE' | 'COMMENT' | 'FOLLOW'; postId?: number }): Promise<Notification> {
    const newN: Notification = {
      notificationId: this.notifications.length + 1,
      recipientUserId: Number(notif.recipientUserId),
      actorUserId: Number(notif.actorUserId),
      actor: { userId: Number(notif.actorUserId), username: 'actor', displayName: 'Actor' },
      type: notif.type,
      postId: notif.postId,
      isRead: false,
      createdAt: new Date().toISOString()
    };
    this.notifications.push(newN);
    return newN;
  }
}

export class MockStoryRepository implements IStoryRepository {
  private stories: Story[] = [];
  async getFeedStories(): Promise<Story[]> {
    return this.stories.filter((s) => new Date(s.expiresAt).valueOf() > Date.now());
  }
  async createStory(story: { userId: number; mediaUrl: string; caption?: string }): Promise<Story> {
    const newStory: Story = {
      storyId: this.stories.length + 1,
      userId: story.userId,
      author: { userId: story.userId, username: 'alex', displayName: 'Alex' },
      mediaUrl: story.mediaUrl,
      caption: story.caption,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString()
    };
    this.stories.push(newStory);
    return newStory;
  }
  async deleteStory(storyId: number, userId: number): Promise<boolean> {
    return true;
  }
}

export class MockReelRepository implements IReelRepository {
  async getReels(): Promise<Reel[]> {
    return [];
  }
  async createReel(reel: { userId: number; videoUrl: string; caption?: string }): Promise<Reel> {
    return {
      reelId: 1,
      userId: reel.userId,
      author: { userId: reel.userId, username: 'alex', displayName: 'Alex' },
      videoUrl: reel.videoUrl,
      caption: reel.caption,
      likesCount: 0,
      createdAt: new Date().toISOString()
    };
  }
  async deleteReel(reelId: number, userId: number): Promise<boolean> {
    return true;
  }
  async likeReel(userId: number, reelId: number): Promise<void> {}
  async unlikeReel(userId: number, reelId: number): Promise<void> {}
}

export class MockMessageRepository implements IMessageRepository {
  private messages: Message[] = [];
  async getUserConversations(userId: number): Promise<any[]> {
    return [];
  }
  async getMessagesBetweenUsers(user1Id: number, user2Id: number): Promise<Message[]> {
    return this.messages;
  }
  async sendMessage(msg: { senderId: number; receiverId: number; content: string }): Promise<Message> {
    const newMsg: Message = {
      messageId: this.messages.length + 1,
      senderId: msg.senderId,
      receiverId: msg.receiverId,
      sender: { userId: msg.senderId, username: 'sender', displayName: 'Sender' },
      content: msg.content,
      isRead: false,
      createdAt: new Date().toISOString()
    };
    this.messages.push(newMsg);
    return newMsg;
  }
  async markMessageAsRead(messageId: number, receiverUserId: number): Promise<{ rowsAffected: number; readAt: Date | null; senderId: number | null }> {
    return { rowsAffected: 1, readAt: new Date(), senderId: 1 };
  }
}

export class MockAuthRepository implements IAuthRepository {
  async storeRefreshToken(userId: number, tokenHash: string, expiresAt: Date): Promise<void> {}
  async saveRefreshToken(userId: number, tokenHash: string, expiresAt: Date): Promise<void> {}
  async findRefreshToken(tokenHash: string): Promise<any> { return null; }
  async revokeRefreshToken(tokenHash: string): Promise<void> {}
  async revokeAllUserRefreshTokens(userId: number): Promise<void> {}
  async revokeAllUserTokens(userId: number): Promise<void> {}
}

export class MockSecurityRepository implements ISecurityRepository {
  async getSecuritySettings(userId: number): Promise<any> { return null; }
  async updateSecuritySettings(userId: number, updates: any): Promise<any> { return null; }
  async createSession(session: any): Promise<void> {}
  async getSessions(userId: number): Promise<any[]> { return []; }
  async getUserSessions(userId: number): Promise<any[]> { return []; }
  async revokeSession(sessionId: string, userId: number): Promise<boolean> { return true; }
  async revokeOtherSessions(userId: number, currentSessionId: string): Promise<void> {}
  async logSecurityEvent(event: { userId: number; sessionId?: string; eventType: string; outcome: 'SUCCESS' | 'FAILURE'; deviceSummary?: string }): Promise<void> {}
}
