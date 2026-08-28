-- 05_add_ai_trigger_key.sql
-- Adds the trigger_key column to messages and group_messages to align with the application layer

BEGIN;

-- 1. Direct Messages Table
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS trigger_key VARCHAR(255);

-- 2. Group Messages Table
ALTER TABLE group_messages
  ADD COLUMN IF NOT EXISTS trigger_key VARCHAR(255);

COMMIT;
