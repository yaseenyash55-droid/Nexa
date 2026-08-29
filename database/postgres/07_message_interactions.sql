-- ====================================================================
-- NEXA POSTGRESQL DATABASE SCHEMA MIGRATION
-- FILE: database/postgres/07_message_interactions.sql
-- DESCRIPTION: Message Interactions Phase — Reactions, Edit, Reply
--              Adds message_reactions table, edited_at and
--              reply_to_message_id to messages and group_messages.
-- TARGETS: PostgreSQL 14+ / Supabase / Neon / Render PostgreSQL
-- SAFE: All operations are ADDITIVE. No destructive changes.
--       Uses IF NOT EXISTS / DO $$ blocks for idempotency.
-- ====================================================================

-- ----------------------------------------------------------------
-- 1. Add reply_to_message_id to messages (DMs)
-- ----------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'reply_to_message_id'
  ) THEN
    ALTER TABLE messages
      ADD COLUMN reply_to_message_id BIGINT
        REFERENCES messages(message_id) ON DELETE SET NULL;
  END IF;
END $$;

-- ----------------------------------------------------------------
-- 2. Add edited_at to messages (DMs)
-- ----------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'edited_at'
  ) THEN
    ALTER TABLE messages ADD COLUMN edited_at TIMESTAMPTZ;
  END IF;
END $$;

-- ----------------------------------------------------------------
-- 3. Add reply_to_message_id to group_messages
-- ----------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'group_messages' AND column_name = 'reply_to_message_id'
  ) THEN
    ALTER TABLE group_messages
      ADD COLUMN reply_to_message_id BIGINT
        REFERENCES group_messages(message_id) ON DELETE SET NULL;
  END IF;
END $$;

-- ----------------------------------------------------------------
-- 4. Add edited_at to group_messages
-- ----------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'group_messages' AND column_name = 'edited_at'
  ) THEN
    ALTER TABLE group_messages ADD COLUMN edited_at TIMESTAMPTZ;
  END IF;
END $$;

-- ----------------------------------------------------------------
-- 5. Add is_unsent to group_messages (parity with messages)
-- ----------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'group_messages' AND column_name = 'is_unsent'
  ) THEN
    ALTER TABLE group_messages ADD COLUMN is_unsent BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

-- ----------------------------------------------------------------
-- 6. Create message_reactions table
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS message_reactions (
  reaction_id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message_id          BIGINT
    REFERENCES messages(message_id) ON DELETE CASCADE,
  group_message_id    BIGINT
    REFERENCES group_messages(message_id) ON DELETE CASCADE,
  user_id             BIGINT NOT NULL
    REFERENCES users(user_id) ON DELETE CASCADE,
  reaction            VARCHAR(10) NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,

  -- Exactly one destination: DM or group message, never both, never neither
  CONSTRAINT chk_reaction_destination CHECK (
    (message_id IS NOT NULL AND group_message_id IS NULL) OR
    (message_id IS NULL AND group_message_id IS NOT NULL)
  ),

  -- One active reaction per user per DM message
  CONSTRAINT uq_reaction_dm    UNIQUE (message_id, user_id),

  -- One active reaction per user per group message
  CONSTRAINT uq_reaction_group UNIQUE (group_message_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reactions_message_id
  ON message_reactions (message_id)
  WHERE message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reactions_group_message_id
  ON message_reactions (group_message_id)
  WHERE group_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reactions_user_id
  ON message_reactions (user_id);

-- ----------------------------------------------------------------
-- 7. Indexes on new columns
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_messages_reply_to
  ON messages (reply_to_message_id)
  WHERE reply_to_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_group_messages_reply_to
  ON group_messages (reply_to_message_id)
  WHERE reply_to_message_id IS NOT NULL;
