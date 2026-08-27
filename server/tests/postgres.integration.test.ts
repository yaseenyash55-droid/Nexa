import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import supertest from 'supertest';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { postgresRepositoryManager } from '../src/repositories/index.js';
import { signAccessToken } from '../src/utils/jwt.js';
import { realtimeServer } from '../src/socket.js';
import * as postgresPool from '../src/db/postgres.pool.js';
import * as dbIndex from '../src/db/index.js';

describe('PostgreSQL Migration Verification Pass (DATABASE_PROVIDER=postgres)', () => {
  let originalProvider: string;

  beforeEach(() => {
    originalProvider = env.DATABASE_PROVIDER;
    (env as any).DATABASE_PROVIDER = 'postgres';
    vi.spyOn(dbIndex, 'withDatabaseTransaction').mockImplementation(async (cb: any) => cb(null));
    vi.spyOn(postgresPool, 'withPostgresTransaction').mockImplementation(async (cb: any) => cb(null));
    vi.spyOn(postgresRepositoryManager.userRepo, 'isFollowing').mockResolvedValue(false);
    vi.spyOn(postgresRepositoryManager.privacyRepo, 'getPrivacySettings').mockResolvedValue({
      isPrivate: false,
      whoCanMessage: 'EVERYONE',
      whoCanComment: 'EVERYONE',
      activityStatusVisible: true,
      readReceiptsEnabled: true,
      hideLikeCounts: false
    });
  });

  afterEach(() => {
    (env as any).DATABASE_PROVIDER = originalProvider;
    vi.restoreAllMocks();
  });

  // 1. Database Health
  describe('1. Database Health Check', () => {
    it('verifies GET /api/health returns mode: postgres and healthy status', async () => {
      vi.spyOn(postgresPool, 'checkPostgresHealth').mockResolvedValue({
        reachable: true,
        details: 'Connected'
      });

      const res = await supertest(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.data.mode).toBe('postgres');
      expect(res.body.data.database.provider).toBe('postgres');
      expect(res.body.data.database.reachable).toBe(true);
    });

    it('verifies GET /api/health/ready returns 200 when postgres is reachable', async () => {
      vi.spyOn(postgresPool, 'checkPostgresHealth').mockResolvedValue({
        reachable: true,
        details: 'Connected'
      });

      const res = await supertest(app).get('/api/health/ready');
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ready');
      expect(res.body.data.mode).toBe('postgres');
    });
  });

  // 2. Authentication & Registration
  describe('2. Registration & Login Flow', () => {
    it('registers a new user successfully via PostgreSQL User & Auth repos', async () => {
      const mockUser = {
        userId: 10,
        username: 'newpguser',
        email: 'newpguser@nexa.app',
        displayName: 'New PG User',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      vi.spyOn(postgresRepositoryManager.userRepo, 'findByUsername').mockResolvedValue(null);
      vi.spyOn(postgresRepositoryManager.userRepo, 'findByEmail').mockResolvedValue(null);
      vi.spyOn(postgresRepositoryManager.userRepo, 'createUserOnConnection').mockResolvedValue(mockUser);
      vi.spyOn(postgresRepositoryManager.authRepo, 'saveRefreshTokenOnConnection').mockResolvedValue();

      const res = await supertest(app)
        .post('/api/auth/register')
        .send({
          username: 'newpguser',
          email: 'newpguser@nexa.app',
          password: 'Password123!',
          displayName: 'New PG User'
        });

      expect(res.status).toBe(201);
      expect(res.body.data.user.username).toBe('newpguser');
      expect(res.body.data.accessToken).toBeDefined();
    });

    it('logs in an existing user with valid password and issues JWT', async () => {
      const bcrypt = await import('bcryptjs');
      const hash = await bcrypt.hash('Password123!', 10);
      const mockUser = {
        userId: 10,
        username: 'pgloginuser',
        email: 'pgloginuser@nexa.app',
        passwordHash: hash,
        displayName: 'PG Login User',
        failedLoginAttempts: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      vi.spyOn(postgresRepositoryManager.userRepo, 'findByEmail').mockResolvedValue(mockUser);
      vi.spyOn(postgresRepositoryManager.userRepo, 'findCredentialById').mockResolvedValue({
        userId: 10,
        passwordHash: hash
      });
      vi.spyOn(postgresRepositoryManager.securityRepo, 'getSecuritySettings').mockResolvedValue({
        mfaEnabled: false,
        emailVerifiedAt: null
      });
      vi.spyOn(postgresRepositoryManager.authRepo, 'saveRefreshToken').mockResolvedValue();
      vi.spyOn(postgresRepositoryManager.userRepo, 'resetLockoutState').mockResolvedValue();

      const res = await supertest(app)
        .post('/api/auth/login')
        .send({
          emailOrUsername: 'pgloginuser@nexa.app',
          password: 'Password123!'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.user.username).toBe('pgloginuser');
      expect(res.body.data.accessToken).toBeDefined();
    });
  });

  // 3. JWT Authentication Middleware
  describe('3. JWT Authentication Enforcement', () => {
    it('authenticates valid Bearer tokens and injects user context', async () => {
      const token = signAccessToken({ userId: 10, username: 'testauth', email: 'test@nexa.app' });
      vi.spyOn(postgresRepositoryManager.userRepo, 'findById').mockResolvedValue({
        userId: 10,
        username: 'testauth',
        email: 'test@nexa.app',
        displayName: 'Test Auth',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const res = await supertest(app)
        .get('/api/users/10')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.userId).toBe(10);
    });

    it('rejects unauthenticated requests with 401 on protected endpoints', async () => {
      const res = await supertest(app)
        .post('/api/posts/create')
        .send({ content: 'Unauthenticated post' });

      expect(res.status).toBe(401);
    });
  });

  // 4. Profiles & Profile Updates
  describe('4. Profiles & Profile Updates', () => {
    it('fetches user profile by username', async () => {
      const token = signAccessToken({ userId: 1, username: 'alex', email: 'alex@nexa.app' });
      vi.spyOn(postgresRepositoryManager.userRepo, 'findByUsername').mockResolvedValue({
        userId: 1,
        username: 'alex',
        email: 'alex@nexa.app',
        displayName: 'Alex Rivera',
        bio: 'PostgreSQL Architect',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        followersCount: 5,
        followingCount: 3
      });
      vi.spyOn(postgresRepositoryManager.userRepo, 'isFollowing').mockResolvedValue(false);

      const res = await supertest(app)
        .get('/api/users/username/alex')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.username).toBe('alex');
      expect(res.body.data.bio).toBe('PostgreSQL Architect');
    });

    it('updates user profile bio and display name', async () => {
      const token = signAccessToken({ userId: 1, username: 'alex', email: 'alex@nexa.app' });
      vi.spyOn(postgresRepositoryManager.userRepo, 'updateUser').mockResolvedValue({
        userId: 1,
        username: 'alex',
        email: 'alex@nexa.app',
        displayName: 'Alex Updated',
        bio: 'Updated Bio',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const res = await supertest(app)
        .put('/api/users/1')
        .set('Authorization', `Bearer ${token}`)
        .send({
          displayName: 'Alex Updated',
          bio: 'Updated Bio'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.displayName).toBe('Alex Updated');
      expect(res.body.data.bio).toBe('Updated Bio');
    });
  });

  // 5. Posts, Feed, Likes & Comments
  describe('5. Posts, Feed, Likes & Comments', () => {
    const token = signAccessToken({ userId: 1, username: 'alex', email: 'alex@nexa.app' });

    it('creates a new post', async () => {
      vi.spyOn(postgresRepositoryManager.postRepo, 'createPost').mockResolvedValue({
        postId: 100,
        userId: 1,
        author: { userId: 1, username: 'alex', displayName: 'Alex Rivera' },
        content: 'PostgreSQL feed verification!',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        likesCount: 0,
        commentsCount: 0
      });

      const res = await supertest(app)
        .post('/api/posts/create')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'PostgreSQL feed verification!' });

      expect(res.status).toBe(201);
      expect(res.body.data.postId).toBe(100);
      expect(res.body.data.content).toBe('PostgreSQL feed verification!');
    });

    it('retrieves global feed', async () => {
      vi.spyOn(postgresRepositoryManager.postRepo, 'getGlobalFeed').mockResolvedValue({
        data: [{
          postId: 100,
          userId: 1,
          author: { userId: 1, username: 'alex', displayName: 'Alex Rivera' },
          content: 'PostgreSQL feed verification!',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          likesCount: 5,
          commentsCount: 2,
          isLiked: true,
          isBookmarked: false
        }],
        nextCursor: null,
        hasMore: false
      });

      const res = await supertest(app)
        .get('/api/posts/feed')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].isLiked).toBe(true);
    });

    it('likes a post and increments like count', async () => {
      vi.spyOn(postgresRepositoryManager.postRepo, 'findById').mockResolvedValue({
        postId: 100,
        userId: 2,
        author: { userId: 2, username: 'sarah', displayName: 'Sarah' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        likesCount: 1,
        commentsCount: 0
      });
      vi.spyOn(postgresRepositoryManager.postRepo, 'likePost').mockResolvedValue();
      vi.spyOn(postgresRepositoryManager.notificationRepo, 'createNotification').mockResolvedValue({} as any);

      const res = await supertest(app)
        .post('/api/posts/100/like')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('adds a comment to a post', async () => {
      vi.spyOn(postgresRepositoryManager.postRepo, 'findById').mockResolvedValue({
        postId: 100,
        userId: 2,
        author: { userId: 2, username: 'sarah', displayName: 'Sarah' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        likesCount: 1,
        commentsCount: 1
      });
      vi.spyOn(postgresRepositoryManager.commentRepo, 'createComment').mockResolvedValue({
        commentId: 50,
        postId: 100,
        userId: 1,
        author: { userId: 1, username: 'alex', displayName: 'Alex Rivera' },
        content: 'Great post!',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      vi.spyOn(postgresRepositoryManager.notificationRepo, 'createNotification').mockResolvedValue({} as any);

      const res = await supertest(app)
        .post('/api/posts/100/comment')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Great post!' });

      expect(res.status).toBe(201);
      expect(res.body.data.commentId).toBe(50);
      expect(res.body.data.content).toBe('Great post!');
    });
  });

  // 6. Follow / Unfollow & Search
  describe('6. Follow / Unfollow & Search', () => {
    const token = signAccessToken({ userId: 1, username: 'alex', email: 'alex@nexa.app' });

    it('follows another user', async () => {
      vi.spyOn(postgresRepositoryManager.userRepo, 'findById').mockResolvedValue({
        userId: 2,
        username: 'sarah',
        email: 'sarah@nexa.app',
        displayName: 'Sarah',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      vi.spyOn(postgresRepositoryManager.privacyRepo, 'getPrivacySettings').mockResolvedValue({
        userId: 2,
        isPrivate: false,
        whoCanMessage: 'EVERYONE',
        whoCanComment: 'EVERYONE',
        activityStatusVisible: true,
        readReceiptsEnabled: true,
        hideLikeCounts: false,
        updatedAt: new Date().toISOString()
      });
      vi.spyOn(postgresRepositoryManager.userRepo, 'followUser').mockResolvedValue();
      vi.spyOn(postgresRepositoryManager.notificationRepo, 'createNotification').mockResolvedValue({} as any);

      const res = await supertest(app)
        .post('/api/users/2/follow')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
    });

    it('searches users by query string', async () => {
      vi.spyOn(postgresRepositoryManager.userRepo, 'searchUsers').mockResolvedValue([{
        userId: 2,
        username: 'sarah_design',
        email: 'sarah@nexa.app',
        displayName: 'Sarah Chen',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }]);

      const res = await supertest(app)
        .get('/api/users/search?q=sarah')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].username).toBe('sarah_design');
    });
  });

  // 7. Stories & Reels
  describe('7. Stories & Reels', () => {
    const token = signAccessToken({ userId: 1, username: 'alex', email: 'alex@nexa.app' });

    it('creates and retrieves active stories', async () => {
      vi.spyOn(postgresRepositoryManager.storyRepo, 'createStory').mockResolvedValue({
        storyId: 1,
        userId: 1,
        author: { userId: 1, username: 'alex', displayName: 'Alex Rivera' },
        mediaUrl: 'https://cdn.nexa.app/story1.jpg',
        caption: 'My Postgres Story',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString()
      });
      vi.spyOn(postgresRepositoryManager.storyRepo, 'getFeedStories').mockResolvedValue([{
        storyId: 1,
        userId: 1,
        author: { userId: 1, username: 'alex', displayName: 'Alex Rivera' },
        mediaUrl: 'https://cdn.nexa.app/story1.jpg',
        caption: 'My Postgres Story',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString()
      }]);

      const createRes = await supertest(app)
        .post('/api/stories')
        .set('Authorization', `Bearer ${token}`)
        .send({ mediaUrl: 'https://cdn.nexa.app/story1.jpg', caption: 'My Postgres Story' });

      expect(createRes.status).toBe(201);
      expect(createRes.body.data.storyId).toBe(1);

      const feedRes = await supertest(app)
        .get('/api/stories/feed')
        .set('Authorization', `Bearer ${token}`);

      expect(feedRes.status).toBe(200);
      expect(feedRes.body.data.length).toBe(1);
    });

    it('creates and lists reels feed', async () => {
      vi.spyOn(postgresRepositoryManager.reelRepo, 'createReel').mockResolvedValue({
        reelId: 1,
        userId: 1,
        author: { userId: 1, username: 'alex', displayName: 'Alex Rivera' },
        videoUrl: 'https://cdn.nexa.app/reel1.mp4',
        caption: 'Postgres Reel',
        likesCount: 0,
        createdAt: new Date().toISOString()
      });
      vi.spyOn(postgresRepositoryManager.reelRepo, 'getReels').mockResolvedValue([{
        reelId: 1,
        userId: 1,
        author: { userId: 1, username: 'alex', displayName: 'Alex Rivera' },
        videoUrl: 'https://cdn.nexa.app/reel1.mp4',
        caption: 'Postgres Reel',
        likesCount: 10,
        isLiked: true,
        createdAt: new Date().toISOString()
      }]);

      const res = await supertest(app)
        .get('/api/reels')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].videoUrl).toContain('reel1.mp4');
    });
  });

  // 8. Notifications, Messages & Socket.IO
  describe('8. Notifications, Messages & Socket.IO Realtime', () => {
    const token = signAccessToken({ userId: 1, username: 'alex', email: 'alex@nexa.app' });

    it('fetches notifications and marks all as read', async () => {
      vi.spyOn(postgresRepositoryManager.notificationRepo, 'getUserNotifications').mockResolvedValue({
        data: [{
          notificationId: 1,
          recipientUserId: 1,
          actorUserId: 2,
          actor: { userId: 2, username: 'sarah', displayName: 'Sarah' },
          type: 'LIKE',
          isRead: false,
          createdAt: new Date().toISOString()
        }],
        nextCursor: null,
        hasMore: false
      });
      vi.spyOn(postgresRepositoryManager.notificationRepo, 'markAllAsRead').mockResolvedValue();

      const getRes = await supertest(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${token}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.length).toBe(1);

      const readAllRes = await supertest(app)
        .post('/api/notifications/read-all')
        .set('Authorization', `Bearer ${token}`);

      expect(readAllRes.status).toBe(200);
    });

    it('sends direct messages and fetches conversation messages', async () => {
      vi.spyOn(postgresRepositoryManager.messageRepo, 'sendMessage').mockResolvedValue({
        messageId: 1,
        senderId: 1,
        receiverId: 2,
        sender: { userId: 1, username: 'alex', displayName: 'Alex Rivera' },
        content: 'Hello via PostgreSQL!',
        isRead: false,
        createdAt: new Date().toISOString()
      });
      vi.spyOn(postgresRepositoryManager.messageRepo, 'getMessagesBetweenUsers').mockResolvedValue([{
        messageId: 1,
        senderId: 1,
        receiverId: 2,
        sender: { userId: 1, username: 'alex', displayName: 'Alex Rivera' },
        content: 'Hello via PostgreSQL!',
        isRead: false,
        createdAt: new Date().toISOString()
      }]);
      vi.spyOn(postgresRepositoryManager.messageRepo, 'markMessageAsRead').mockResolvedValue({
        rowsAffected: 1,
        readAt: new Date(),
        senderId: 2
      });

      const sendRes = await supertest(app)
        .post('/api/messages')
        .set('Authorization', `Bearer ${token}`)
        .send({ receiverId: 2, content: 'Hello via PostgreSQL!' });

      expect(sendRes.status).toBe(201);
      expect(sendRes.body.data.content).toBe('Hello via PostgreSQL!');

      const msgRes = await supertest(app)
        .get('/api/messages/2')
        .set('Authorization', `Bearer ${token}`);

      expect(msgRes.status).toBe(200);
      expect(msgRes.body.data.length).toBe(1);

      const readRes = await supertest(app)
        .post('/api/messages/1/read')
        .set('Authorization', `Bearer ${token}`);

      expect(readRes.status).toBe(200);
      expect(readRes.body.data.read).toBe(true);
    });

    it('verifies Socket.IO realtime handshake and message dispatch helpers', () => {
      const user = realtimeServer.authenticateHandshakeToken(`Bearer ${token}`);
      expect(user).not.toBeNull();
      expect(user?.userId).toBe(1);
      expect(user?.username).toBe('alex');
    });
  });
});
