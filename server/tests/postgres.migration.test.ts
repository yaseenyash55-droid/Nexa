import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sanitizePostgresUrl } from '../src/db/postgres.pool.js';
import { getRepositoryManager, postgresRepositoryManager, oracleRepositoryManager } from '../src/repositories/index.js';
import { getGroupRepository, getBroadcastRepository } from '../src/repositories/factory.js';
import { PostgresGroupRepository } from '../src/repositories/postgres/group.postgres.repo.js';
import { PostgresBroadcastRepository } from '../src/repositories/postgres/broadcast.postgres.repo.js';
import { PostgresUserRepository } from '../src/repositories/postgres/user.postgres.repo.js';
import { PostgresPostRepository } from '../src/repositories/postgres/post.postgres.repo.js';
import { PostgresCommentRepository } from '../src/repositories/postgres/comment.postgres.repo.js';
import { PostgresNotificationRepository } from '../src/repositories/postgres/notification.postgres.repo.js';
import { PostgresStoryRepository } from '../src/repositories/postgres/story.postgres.repo.js';
import { PostgresReelRepository } from '../src/repositories/postgres/reel.postgres.repo.js';
import { PostgresMessageRepository } from '../src/repositories/postgres/message.postgres.repo.js';
import { PostgresAuthRepository } from '../src/repositories/postgres/auth.postgres.repo.js';
import { PostgresSecurityRepository } from '../src/repositories/postgres/security.postgres.repo.js';
import { PostgresFcmTokenRepository } from '../src/repositories/postgres/fcm.postgres.repo.js';
import { PostgresPrivacyRepository } from '../src/repositories/postgres/privacy.postgres.repo.js';
import { checkDatabaseHealth } from '../src/db/index.js';
import * as postgresPool from '../src/db/postgres.pool.js';
import { env } from '../src/config/env.js';

describe('PostgreSQL Migration Unit Tests', () => {
  describe('Connection URL Sanitization', () => {
    it('sanitizes password from standard postgresql connection URLs', () => {
      const raw = 'postgresql://postgres:secretpassword123@db.supabase.co:5432/postgres';
      const sanitized = sanitizePostgresUrl(raw);
      expect(sanitized).toBe('postgresql://postgres:***@db.supabase.co:5432/postgres');
      expect(sanitized).not.toContain('secretpassword123');
    });

    it('sanitizes password from postgres connection URLs with query parameters', () => {
      const raw = 'postgres://admin:topsecret@aws.render.com:5432/nexadb?sslmode=require';
      const sanitized = sanitizePostgresUrl(raw);
      expect(sanitized).toBe('postgres://admin:***@aws.render.com:5432/nexadb?sslmode=require');
      expect(sanitized).not.toContain('topsecret');
    });

    it('handles empty string gracefully', () => {
      expect(sanitizePostgresUrl('')).toBe('');
    });
  });

  describe('Repository Manager Selection', () => {
    it('returns postgresRepositoryManager when DATABASE_PROVIDER is postgres', () => {
      const original = env.DATABASE_PROVIDER;
      (env as any).DATABASE_PROVIDER = 'postgres';

      const repoManager = getRepositoryManager();
      expect(repoManager).toBe(postgresRepositoryManager);
      expect(repoManager.userRepo).toBeInstanceOf(PostgresUserRepository);
      expect(repoManager.postRepo).toBeInstanceOf(PostgresPostRepository);
      expect(repoManager.commentRepo).toBeInstanceOf(PostgresCommentRepository);
      expect(repoManager.notificationRepo).toBeInstanceOf(PostgresNotificationRepository);
      expect(repoManager.storyRepo).toBeInstanceOf(PostgresStoryRepository);
      expect(repoManager.reelRepo).toBeInstanceOf(PostgresReelRepository);
      expect(repoManager.messageRepo).toBeInstanceOf(PostgresMessageRepository);
      expect(repoManager.authRepo).toBeInstanceOf(PostgresAuthRepository);
      expect(repoManager.securityRepo).toBeInstanceOf(PostgresSecurityRepository);
      expect(repoManager.fcmTokenRepo).toBeInstanceOf(PostgresFcmTokenRepository);
      expect(repoManager.privacyRepo).toBeInstanceOf(PostgresPrivacyRepository);

      (env as any).DATABASE_PROVIDER = original;
    });

    it('returns oracleRepositoryManager when DATABASE_PROVIDER is oracle', () => {
      const original = env.DATABASE_PROVIDER;
      (env as any).DATABASE_PROVIDER = 'oracle';

      const repoManager = getRepositoryManager();
      expect(repoManager).toBe(oracleRepositoryManager);

      (env as any).DATABASE_PROVIDER = original;
    });

    it('factory functions return PostgreSQL group and broadcast repos when in postgres mode', () => {
      const original = env.DATABASE_PROVIDER;
      (env as any).DATABASE_PROVIDER = 'postgres';

      expect(getGroupRepository()).toBeInstanceOf(PostgresGroupRepository);
      expect(getBroadcastRepository()).toBeInstanceOf(PostgresBroadcastRepository);

      (env as any).DATABASE_PROVIDER = original;
    });
  });

  describe('Database Health Check with Dual Provider', () => {
    it('checks postgres health when provider is postgres', async () => {
      const original = env.DATABASE_PROVIDER;
      (env as any).DATABASE_PROVIDER = 'postgres';

      const spy = vi.spyOn(postgresPool, 'checkPostgresHealth').mockResolvedValue({
        reachable: true,
        details: 'Connected'
      });

      const health = await checkDatabaseHealth();
      expect(health.provider).toBe('postgres');
      expect(health.reachable).toBe(true);
      expect(health.details).toBe('Connected');
      expect(spy).toHaveBeenCalled();

      spy.mockRestore();
      (env as any).DATABASE_PROVIDER = original;
    });
  });

  describe('PostgreSQL Repositories Mock Flow & Data Mapping', () => {
    it('PostgresUserRepository maps lowercase columns and formats timestamps properly', async () => {
      const userRepo = new PostgresUserRepository();
      const mockRow = {
        user_id: 42,
        username: 'alice',
        email: 'alice@nexa.social',
        password_hash: 'hashedpassword',
        display_name: 'Alice W',
        bio: 'Hello world',
        profile_image_url: 'https://cdn.nexa.social/avatar.png',
        cover_image_url: null,
        location: 'Earth',
        website_url: 'https://alice.dev',
        failed_login_attempts: 0,
        first_failed_attempt_at: null,
        lockout_until: null,
        created_at: new Date('2026-01-01T00:00:00Z'),
        updated_at: new Date('2026-01-02T00:00:00Z'),
        followers_count: '15',
        following_count: '8',
        is_following: 1
      };

      const spy = vi.spyOn(postgresPool, 'executePostgresSql').mockResolvedValue({
        rows: [mockRow],
        rowCount: 1
      });

      const user = await userRepo.findById(42, 1);
      expect(user).not.toBeNull();
      expect(user?.userId).toBe(42);
      expect(user?.username).toBe('alice');
      expect(user?.displayName).toBe('Alice W');
      expect(user?.followersCount).toBe(15);
      expect(user?.followingCount).toBe(8);
      expect(user?.isFollowing).toBe(true);
      expect(user?.createdAt).toBe(new Date('2026-01-01T00:00:00Z').toISOString());

      spy.mockRestore();
    });

    it('PostgresPostRepository maps post feed with author and interaction counts', async () => {
      const postRepo = new PostgresPostRepository();
      const mockPostRow = {
        post_id: 101,
        user_id: 42,
        content: 'PostgreSQL migration is ready!',
        image_url: 'https://cdn.nexa.social/post.jpg',
        created_at: new Date('2026-02-01T12:00:00Z'),
        updated_at: new Date('2026-02-01T12:00:00Z'),
        author_username: 'alice',
        author_display_name: 'Alice W',
        author_profile_image: 'https://cdn.nexa.social/avatar.png',
        likes_count: '24',
        comments_count: '5',
        is_liked: 1,
        is_bookmarked: 0
      };

      const spy = vi.spyOn(postgresPool, 'executePostgresSql').mockResolvedValue({
        rows: [mockPostRow],
        rowCount: 1
      });

      const feed = await postRepo.getGlobalFeed(42, undefined, 10);
      expect(feed.data.length).toBe(1);
      expect(feed.data[0].postId).toBe(101);
      expect(feed.data[0].author.username).toBe('alice');
      expect(feed.data[0].likesCount).toBe(24);
      expect(feed.data[0].commentsCount).toBe(5);
      expect(feed.data[0].isLiked).toBe(true);
      expect(feed.data[0].isBookmarked).toBe(false);

      spy.mockRestore();
    });

    it('PostgresMessageRepository returns the flat conversation contract used by Android', async () => {
      const messageRepo = new PostgresMessageRepository();
      const spy = vi.spyOn(postgresPool, 'executePostgresSql').mockResolvedValue({
        rows: [{
          partner_id: '821',
          username: 'leon_yash',
          display_name: 'Yash',
          profile_image_url: 'https://cdn.nexa.social/leon.png',
          last_message: 'hi',
          last_message_at: new Date('2026-08-23T13:05:21.829Z'),
          last_message_sender_id: '821',
          unread_count: '1'
        }],
        rowCount: 1
      });

      const conversations = await messageRepo.getConversations(999);

      expect(conversations).toEqual([{
        otherUserId: 821,
        username: 'leon_yash',
        displayName: 'Yash',
        profileImageUrl: 'https://cdn.nexa.social/leon.png',
        lastMessage: 'hi',
        lastMessageAt: '2026-08-23T13:05:21.829Z',
        unreadCount: 1
      }]);
      expect(conversations[0]).not.toHaveProperty('partnerId');
      expect(conversations[0]).not.toHaveProperty('user');

      spy.mockRestore();
    });
  });

  describe('PostgreSQL DDL & Seed File Syntax Validation', () => {
    it('verifies 01_schema.sql has all 30 table definitions and zero Oracle-specific keywords', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const schemaPath = path.resolve(__dirname, '../../database/postgres/01_schema.sql');
      expect(fs.existsSync(schemaPath)).toBe(true);

      const ddl = fs.readFileSync(schemaPath, 'utf-8');
      
      // Zero Oracle-specific syntax
      expect(ddl).not.toContain('VARCHAR2');
      expect(ddl).not.toContain('NUMBER GENERATED');
      expect(ddl).not.toContain('SYSTIMESTAMP');
      expect(ddl).not.toContain('EXECUTE IMMEDIATE');
      expect(ddl).not.toContain('DBMS_OUTPUT');

      // Key PostgreSQL features present
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS users');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS posts');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS comments');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS likes');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS followers');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS refresh_tokens');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS bookmarks');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS notifications');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS messages');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS stories');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS reels');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS reel_likes');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS media_assets');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS groups');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS group_members');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS group_messages');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS broadcasts');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS broadcast_recipients');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS user_security_settings');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS user_sessions');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS mfa_recovery_codes');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS email_verification_tokens');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS password_reset_tokens');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS security_events');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS user_privacy_settings');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS user_hidden_words');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS user_blocks');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS follow_requests');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS user_reports');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS moderation_actions');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS login_otp_challenges');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS fcm_tokens');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS upload_sessions');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS upload_parts');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS durable_outbox');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS media_processing_jobs');
      expect(ddl).toContain('CREATE TABLE IF NOT EXISTS schema_migrations');
    });

    it('verifies 02_seed.sql exists and contains valid PostgreSQL seed commands', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const seedPath = path.resolve(__dirname, '../../database/postgres/02_seed.sql');
      expect(fs.existsSync(seedPath)).toBe(true);

      const seedSql = fs.readFileSync(seedPath, 'utf-8');
      expect(seedSql).toContain('INSERT INTO users');
      expect(seedSql).toContain('INSERT INTO posts');
      expect(seedSql).toContain('INSERT INTO followers');
      expect(seedSql).toContain('INSERT INTO likes');
      expect(seedSql).toContain('INSERT INTO comments');
      expect(seedSql).toContain('INSERT INTO bookmarks');
      expect(seedSql).toContain('INSERT INTO notifications');
      expect(seedSql).not.toContain('SYSTIMESTAMP');
      expect(seedSql).not.toContain('DBMS_OUTPUT');
    });
  });
});
