-- 04_ai_message_persistence_and_idempotency.sql
-- Additive PostgreSQL migration for AI message persistence & distributed idempotency
-- Safe to run against hosted Supabase/PostgreSQL instances

BEGIN;

-- 1. Direct Messages Table
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS sender_type VARCHAR(10) DEFAULT 'user' NOT NULL,
  ADD COLUMN IF NOT EXISTS ai_agent VARCHAR(30),
  ADD COLUMN IF NOT EXISTS trigger_message_id BIGINT REFERENCES messages(message_id) ON DELETE SET NULL;

-- Allow nullable sender_id for AI messages
ALTER TABLE messages ALTER COLUMN sender_id DROP NOT NULL;

-- Ensure check constraint for AI messages
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_messages_ai_integrity') THEN
    ALTER TABLE messages ADD CONSTRAINT chk_messages_ai_integrity CHECK (
      (sender_type = 'user' AND sender_id IS NOT NULL) OR
      (sender_type = 'ai' AND sender_id IS NULL AND ai_agent IS NOT NULL)
    );
  END IF;
END $$;

-- Unique partial index enforcing 1 AI response per triggering message
CREATE UNIQUE INDEX IF NOT EXISTS uq_messages_trigger_ai
  ON messages (trigger_message_id, ai_agent)
  WHERE trigger_message_id IS NOT NULL AND sender_type = 'ai';

-- 2. Group Messages Table
ALTER TABLE group_messages
  ADD COLUMN IF NOT EXISTS sender_type VARCHAR(10) DEFAULT 'user' NOT NULL,
  ADD COLUMN IF NOT EXISTS ai_agent VARCHAR(30),
  ADD COLUMN IF NOT EXISTS trigger_message_id BIGINT REFERENCES group_messages(message_id) ON DELETE SET NULL;

-- Allow nullable sender_id for AI group messages
ALTER TABLE group_messages ALTER COLUMN sender_id DROP NOT NULL;

-- Ensure check constraint for AI group messages
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_group_messages_ai_integrity') THEN
    ALTER TABLE group_messages ADD CONSTRAINT chk_group_messages_ai_integrity CHECK (
      (sender_type = 'user' AND sender_id IS NOT NULL) OR
      (sender_type = 'ai' AND sender_id IS NULL AND ai_agent IS NOT NULL)
    );
  END IF;
END $$;

-- Unique partial index enforcing 1 AI group response per triggering group message
CREATE UNIQUE INDEX IF NOT EXISTS uq_group_messages_trigger_ai
  ON group_messages (trigger_message_id, ai_agent)
  WHERE trigger_message_id IS NOT NULL AND sender_type = 'ai';

COMMIT;
