-- ====================================================================
-- NEXA POSTGRESQL DATABASE SCHEMA DEFINITION
-- FILE: database/postgres/01_schema.sql
-- DESCRIPTION: Idempotent PostgreSQL DDL Schema Definition for NEXA Social Platform
-- TARGETS: PostgreSQL 14+ / Supabase / Neon / Render PostgreSQL
-- ====================================================================

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  user_id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username                VARCHAR(30) NOT NULL UNIQUE,
  email                   VARCHAR(255) NOT NULL UNIQUE,
  password_hash           VARCHAR(255) NOT NULL,
  display_name            VARCHAR(60) NOT NULL,
  bio                     VARCHAR(500),
  profile_image_url       VARCHAR(1000),
  cover_image_url         VARCHAR(1000),
  location                VARCHAR(100),
  website_url             VARCHAR(500),
  role                    VARCHAR(20) DEFAULT 'USER' NOT NULL CHECK (role IN ('USER', 'MODERATOR', 'ADMIN')),
  failed_login_attempts   INTEGER DEFAULT 0 NOT NULL,
  first_failed_attempt_at TIMESTAMPTZ,
  lockout_until           TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT chk_users_username_len CHECK (LENGTH(username) >= 3),
  CONSTRAINT chk_users_display_len CHECK (LENGTH(display_name) >= 2)
);

CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_display_name ON users (display_name);

-- 2. POSTS TABLE
CREATE TABLE IF NOT EXISTS posts (
  post_id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id                 BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  content                 VARCHAR(2000),
  image_url               VARCHAR(1000),
  created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT chk_posts_non_empty CHECK (content IS NOT NULL OR image_url IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_posts_feed ON posts (created_at DESC, post_id DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts (user_id, created_at DESC);

-- 3. COMMENTS TABLE
CREATE TABLE IF NOT EXISTS comments (
  comment_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  post_id                 BIGINT NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
  user_id                 BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  content                 VARCHAR(1000) NOT NULL,
  created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT chk_comments_len CHECK (LENGTH(TRIM(content)) >= 1)
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON comments (post_id, created_at ASC);

-- 4. LIKES TABLE (COMPOSITE KEY)
CREATE TABLE IF NOT EXISTS likes (
  post_id                 BIGINT NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
  user_id                 BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_user ON likes (user_id);

-- 5. FOLLOWERS TABLE (COMPOSITE KEY & SELF-FOLLOW CHECK)
CREATE TABLE IF NOT EXISTS followers (
  follower_id             BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  following_id            BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT chk_no_self_follow CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_followers_following ON followers (following_id);

-- 6. REFRESH TOKENS TABLE
CREATE TABLE IF NOT EXISTS refresh_tokens (
  token_id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id                 BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token_hash              VARCHAR(255) NOT NULL,
  expires_at              TIMESTAMPTZ NOT NULL,
  revoked_at              TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens (user_id);

-- 7. BOOKMARKS TABLE (COMPOSITE KEY)
CREATE TABLE IF NOT EXISTS bookmarks (
  user_id                 BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  post_id                 BIGINT NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
  created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY (user_id, post_id)
);

-- 8. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS notifications (
  notification_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recipient_user_id       BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  actor_user_id           BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  type                    VARCHAR(30) NOT NULL CHECK (type IN ('LIKE', 'COMMENT', 'FOLLOW')),
  post_id                 BIGINT REFERENCES posts(post_id) ON DELETE CASCADE,
  is_read                 BOOLEAN DEFAULT FALSE NOT NULL,
  created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notif_recipient ON notifications (recipient_user_id, created_at DESC);

-- 9. DIRECT MESSAGES TABLE
CREATE TABLE IF NOT EXISTS messages (
  message_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sender_id               BIGINT REFERENCES users(user_id) ON DELETE CASCADE,
  receiver_id             BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  content                 VARCHAR(4000) NOT NULL,
  sender_type             VARCHAR(10) DEFAULT 'user' NOT NULL CHECK (sender_type IN ('user', 'ai')),
  ai_agent                VARCHAR(30),
  read_at                 TIMESTAMPTZ,
  is_unsent               BOOLEAN DEFAULT FALSE NOT NULL,
  created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT chk_messages_participants CHECK (sender_id IS NULL OR sender_id <> receiver_id),
  CONSTRAINT chk_messages_content CHECK (LENGTH(TRIM(content)) BETWEEN 1 AND 4000),
  CONSTRAINT chk_messages_ai_integrity CHECK (
    (sender_type = 'user' AND sender_id IS NOT NULL) OR
    (sender_type = 'ai' AND sender_id IS NULL AND ai_agent IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (sender_id, receiver_id, message_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread ON messages (receiver_id, read_at, message_id);

-- 10. 24-HOUR STORIES TABLE
CREATE TABLE IF NOT EXISTS stories (
  story_id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id                 BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  media_url               VARCHAR(1000) NOT NULL,
  caption                 VARCHAR(1000),
  music_track_id          VARCHAR(255),
  created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  expires_at              TIMESTAMPTZ DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours') NOT NULL,
  CONSTRAINT chk_stories_expiry CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_stories_active ON stories (expires_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stories_user ON stories (user_id, created_at DESC);

-- 11. REELS AND REEL LIKES
CREATE TABLE IF NOT EXISTS reels (
  reel_id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id                 BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  video_url               VARCHAR(1000) NOT NULL,
  caption                 VARCHAR(1000),
  created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS reel_likes (
  reel_id                 BIGINT NOT NULL REFERENCES reels(reel_id) ON DELETE CASCADE,
  user_id                 BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY (reel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reels_feed ON reels (created_at DESC, reel_id DESC);
CREATE INDEX IF NOT EXISTS idx_reel_likes_user ON reel_likes (user_id, created_at DESC);

-- 12. DURABLE MEDIA METADATA
CREATE TABLE IF NOT EXISTS media_assets (
  asset_id                VARCHAR(36) PRIMARY KEY,
  user_id                 BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  storage_key             VARCHAR(255) NOT NULL UNIQUE,
  original_name           VARCHAR(255) NOT NULL,
  mime_type               VARCHAR(100) NOT NULL,
  size_bytes              BIGINT NOT NULL CHECK (size_bytes > 0),
  media_kind              VARCHAR(20) NOT NULL CHECK (media_kind IN ('AVATAR', 'PHOTO', 'STORY', 'REEL', 'CHAT')),
  created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_media_user_created ON media_assets (user_id, created_at DESC);

-- 13. GROUP CHATS
CREATE TABLE IF NOT EXISTS groups (
  group_id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name                    VARCHAR(100) NOT NULL,
  description             VARCHAR(500),
  created_by              BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  avatar_url              VARCHAR(1000),
  created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT chk_groups_name CHECK (LENGTH(TRIM(name)) BETWEEN 1 AND 100)
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id                BIGINT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  user_id                 BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  role                    VARCHAR(10) DEFAULT 'MEMBER' NOT NULL CHECK (role IN ('ADMIN', 'MEMBER')),
  joined_at               TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS group_messages (
  message_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  group_id                BIGINT NOT NULL REFERENCES groups(group_id) ON DELETE CASCADE,
  sender_id               BIGINT REFERENCES users(user_id) ON DELETE CASCADE,
  content                 VARCHAR(4000) NOT NULL,
  sender_type             VARCHAR(10) DEFAULT 'user' NOT NULL CHECK (sender_type IN ('user', 'ai')),
  ai_agent                VARCHAR(30),
  created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT chk_group_message_content CHECK (LENGTH(TRIM(content)) BETWEEN 1 AND 4000),
  CONSTRAINT chk_group_messages_ai_integrity CHECK (
    (sender_type = 'user' AND sender_id IS NOT NULL) OR
    (sender_type = 'ai' AND sender_id IS NULL AND ai_agent IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members (user_id, group_id);
CREATE INDEX IF NOT EXISTS idx_group_messages_group ON group_messages (group_id, created_at);

-- 14. BROADCAST MESSAGING
CREATE TABLE IF NOT EXISTS broadcasts (
  broadcast_id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sender_id               BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title                   VARCHAR(200) NOT NULL,
  content                 VARCHAR(4000) NOT NULL,
  recipients_count        INTEGER DEFAULT 0 NOT NULL CHECK (recipients_count >= 0),
  created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT chk_broadcast_content CHECK (LENGTH(TRIM(content)) BETWEEN 1 AND 4000)
);

CREATE TABLE IF NOT EXISTS broadcast_recipients (
  broadcast_id            BIGINT NOT NULL REFERENCES broadcasts(broadcast_id) ON DELETE CASCADE,
  recipient_user_id       BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  PRIMARY KEY (broadcast_id, recipient_user_id)
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_sender ON broadcasts (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcast_recipient_user ON broadcast_recipients (recipient_user_id, broadcast_id);

-- 15. USER SECURITY SETTINGS
CREATE TABLE IF NOT EXISTS user_security_settings (
  user_id                 BIGINT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  email_verified_at       TIMESTAMPTZ,
  mfa_enabled             BOOLEAN DEFAULT FALSE NOT NULL,
  totp_secret_ciphertext  VARCHAR(512),
  totp_secret_iv          VARCHAR(128),
  totp_secret_auth_tag    VARCHAR(128),
  mfa_key_version         INTEGER DEFAULT 1 NOT NULL,
  password_changed_at     TIMESTAMPTZ,
  last_protection_check_at TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 16. USER SESSIONS
CREATE TABLE IF NOT EXISTS user_sessions (
  session_id              VARCHAR(64) PRIMARY KEY,
  user_id                 BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  refresh_token_hash      VARCHAR(256) NOT NULL,
  token_family_id         VARCHAR(64) NOT NULL,
  device_name             VARCHAR(128),
  user_agent_summary      VARCHAR(256),
  ip_hash                 VARCHAR(128),
  approx_city             VARCHAR(128),
  country_code            VARCHAR(8),
  created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  last_seen_at            TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  expires_at              TIMESTAMPTZ NOT NULL,
  revoked_at              TIMESTAMPTZ,
  revoke_reason           VARCHAR(128),
  is_trusted              BOOLEAN DEFAULT FALSE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sess_user_expires ON user_sessions (user_id, expires_at);

-- 17. MFA RECOVERY CODES
CREATE TABLE IF NOT EXISTS mfa_recovery_codes (
  recovery_code_id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id                 BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  code_hash               VARCHAR(256) NOT NULL,
  created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  used_at                 TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_rec_user_hash ON mfa_recovery_codes (user_id, code_hash);

-- 18. EMAIL VERIFICATION TOKENS
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  token_id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id                 BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token_hash              VARCHAR(256) NOT NULL,
  expires_at              TIMESTAMPTZ NOT NULL,
  created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  consumed_at             TIMESTAMPTZ
);

-- 19. PASSWORD RESET TOKENS
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id                 BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token_hash              VARCHAR(256) NOT NULL,
  expires_at              TIMESTAMPTZ NOT NULL,
  created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  consumed_at             TIMESTAMPTZ
);

-- 20. SECURITY EVENTS AUDIT LOG
CREATE TABLE IF NOT EXISTS security_events (
  security_event_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id                 BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  session_id              VARCHAR(64),
  event_type              VARCHAR(64) NOT NULL,
  outcome                 VARCHAR(32) NOT NULL,
  device_summary          VARCHAR(256),
  approx_location         VARCHAR(128),
  created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_secevt_user_created ON security_events (user_id, created_at DESC);

-- 21. USER PRIVACY SETTINGS
CREATE TABLE IF NOT EXISTS user_privacy_settings (
  user_id                 BIGINT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  is_private              BOOLEAN DEFAULT FALSE NOT NULL,
  who_can_message         VARCHAR(32) DEFAULT 'EVERYONE' CHECK (who_can_message IN ('EVERYONE', 'FOLLOWING', 'NOBODY')),
  who_can_comment         VARCHAR(32) DEFAULT 'EVERYONE' CHECK (who_can_comment IN ('EVERYONE', 'FOLLOWING', 'NOBODY')),
  activity_status_visible BOOLEAN DEFAULT TRUE NOT NULL,
  read_receipts_enabled   BOOLEAN DEFAULT TRUE NOT NULL,
  hide_like_counts        BOOLEAN DEFAULT FALSE NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 22. USER HIDDEN WORDS
CREATE TABLE IF NOT EXISTS user_hidden_words (
  hidden_word_id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id                 BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  word                    VARCHAR(100) NOT NULL,
  created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT uq_user_hidden_word UNIQUE (user_id, word)
);

CREATE INDEX IF NOT EXISTS idx_hw_user ON user_hidden_words (user_id);

-- 23. USER BLOCKS
CREATE TABLE IF NOT EXISTS user_blocks (
  block_id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  blocker_user_id         BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  blocked_user_id         BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT uq_user_blocks UNIQUE (blocker_user_id, blocked_user_id),
  CONSTRAINT chk_no_self_block CHECK (blocker_user_id <> blocked_user_id)
);

CREATE INDEX IF NOT EXISTS idx_ub_blocker ON user_blocks (blocker_user_id);
CREATE INDEX IF NOT EXISTS idx_ub_blocked ON user_blocks (blocked_user_id);

-- 24. FOLLOW REQUESTS
CREATE TABLE IF NOT EXISTS follow_requests (
  request_id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  requester_user_id       BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  target_user_id          BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  status                  VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED')),
  created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  CONSTRAINT uq_follow_request UNIQUE (requester_user_id, target_user_id),
  CONSTRAINT chk_no_self_freq CHECK (requester_user_id <> target_user_id)
);

CREATE INDEX IF NOT EXISTS idx_freq_tgt_status ON follow_requests (target_user_id, status);

-- 25. USER REPORTS
CREATE TABLE IF NOT EXISTS user_reports (
  report_id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reporter_user_id        BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  target_type             VARCHAR(30) NOT NULL CHECK (target_type IN ('USER', 'POST', 'COMMENT', 'STORY', 'REEL', 'MESSAGE')),
  target_id               BIGINT NOT NULL,
  reason                  VARCHAR(60) NOT NULL,
  details                 VARCHAR(1000),
  status                  VARCHAR(30) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'INVESTIGATING', 'RESOLVED', 'DISMISSED')),
  created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rep_status_created ON user_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rep_target ON user_reports (target_type, target_id);

-- 26. MODERATION ACTIONS
CREATE TABLE IF NOT EXISTS moderation_actions (
  action_id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  report_id               BIGINT REFERENCES user_reports(report_id) ON DELETE SET NULL,
  moderator_user_id       BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  action_type             VARCHAR(50) NOT NULL CHECK (action_type IN ('WARN', 'HIDE_CONTENT', 'DELETE_CONTENT', 'SUSPEND_USER', 'BAN_USER', 'DISMISS_REPORT')),
  target_type             VARCHAR(30) NOT NULL,
  target_id               BIGINT NOT NULL,
  notes                   VARCHAR(1000),
  created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mod_moderator ON moderation_actions (moderator_user_id);
CREATE INDEX IF NOT EXISTS idx_mod_target ON moderation_actions (target_type, target_id);

-- 27. LOGIN OTP CHALLENGES (2FA)
CREATE TABLE IF NOT EXISTS login_otp_challenges (
  challenge_id            VARCHAR(64) PRIMARY KEY,
  user_id                 BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  otp_hash                VARCHAR(64) NOT NULL,
  expires_at              TIMESTAMPTZ NOT NULL,
  attempts                INTEGER DEFAULT 0 NOT NULL CHECK (attempts BETWEEN 0 AND 5),
  consumed_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_login_otp_user ON login_otp_challenges (user_id, created_at);

-- 28. FCM PUSH NOTIFICATION TOKENS
CREATE TABLE IF NOT EXISTS fcm_tokens (
  token_id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id                 BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token                   VARCHAR(512) NOT NULL UNIQUE,
  platform                VARCHAR(32) DEFAULT 'android' NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  device_id               VARCHAR(128),
  created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user ON fcm_tokens (user_id);

-- 29. RESUMABLE UPLOADS & JOBS
CREATE TABLE IF NOT EXISTS upload_sessions (
  session_id              VARCHAR(64) PRIMARY KEY,
  user_id                 BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  media_purpose           VARCHAR(64) NOT NULL,
  expected_bytes          BIGINT NOT NULL,
  uploaded_bytes          BIGINT DEFAULT 0 NOT NULL,
  status                  VARCHAR(32) DEFAULT 'INITIATED' NOT NULL,
  idempotency_key         VARCHAR(128) UNIQUE,
  expires_at              TIMESTAMPTZ NOT NULL,
  created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS upload_parts (
  session_id              VARCHAR(64) NOT NULL REFERENCES upload_sessions(session_id) ON DELETE CASCADE,
  part_number             INTEGER NOT NULL,
  byte_size               BIGINT NOT NULL,
  etag                    VARCHAR(128),
  status                  VARCHAR(32) DEFAULT 'COMPLETED' NOT NULL,
  created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  PRIMARY KEY (session_id, part_number)
);

CREATE TABLE IF NOT EXISTS durable_outbox (
  event_id                VARCHAR(64) PRIMARY KEY,
  event_type              VARCHAR(64) NOT NULL,
  payload_json            TEXT NOT NULL,
  status                  VARCHAR(32) DEFAULT 'PENDING' NOT NULL,
  processed_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS media_processing_jobs (
  job_id                  VARCHAR(64) PRIMARY KEY,
  user_id                 BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  job_type                VARCHAR(64) NOT NULL,
  status                  VARCHAR(32) DEFAULT 'QUEUED' NOT NULL,
  progress                INTEGER DEFAULT 0 NOT NULL,
  retry_count             INTEGER DEFAULT 0 NOT NULL,
  error_message           VARCHAR(1024),
  created_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 30. SCHEMA MIGRATIONS LEDGER
CREATE TABLE IF NOT EXISTS schema_migrations (
  version                 VARCHAR(100) PRIMARY KEY,
  checksum_sha256         VARCHAR(64) NOT NULL,
  applied_at              TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  execution_ms            INTEGER,
  applied_by              VARCHAR(128)
);

