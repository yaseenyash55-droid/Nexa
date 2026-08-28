-- 14_ai_message_persistence.sql
-- Additive migration for explicit AI message identity in Direct and Group messaging
-- Allows SENDER_ID to be NULL for AI/system messages while preserving user FKs and adding discriminator columns

-- ==========================================================
-- 1. DIRECT MESSAGES TABLE (MESSAGES)
-- ==========================================================
ALTER TABLE MESSAGES ADD (
  SENDER_TYPE VARCHAR2(10) DEFAULT 'user' NOT NULL,
  AI_AGENT    VARCHAR2(30)
);

-- Modify SENDER_ID nullability to support AI messages (where SENDER_ID is NULL and SENDER_TYPE = 'ai')
ALTER TABLE MESSAGES MODIFY (SENDER_ID NUMBER NULL);

-- Check constraints for valid message typing
ALTER TABLE MESSAGES ADD CONSTRAINT CHK_MESSAGES_SENDER_TYPE CHECK (SENDER_TYPE IN ('user', 'ai'));
ALTER TABLE MESSAGES ADD CONSTRAINT CHK_MESSAGES_AI_INTEGRITY CHECK (
  (SENDER_TYPE = 'user' AND SENDER_ID IS NOT NULL) OR
  (SENDER_TYPE = 'ai' AND SENDER_ID IS NULL AND AI_AGENT IS NOT NULL)
);

-- ==========================================================
-- 2. GROUP MESSAGES TABLE (GROUP_MESSAGES)
-- ==========================================================
ALTER TABLE GROUP_MESSAGES ADD (
  SENDER_TYPE VARCHAR2(10) DEFAULT 'user' NOT NULL,
  AI_AGENT    VARCHAR2(30)
);

-- Modify SENDER_ID nullability in GROUP_MESSAGES
ALTER TABLE GROUP_MESSAGES MODIFY (SENDER_ID NUMBER NULL);

-- Check constraints for group message typing
ALTER TABLE GROUP_MESSAGES ADD CONSTRAINT CHK_GRP_MESSAGES_SENDER_TYPE CHECK (SENDER_TYPE IN ('user', 'ai'));
ALTER TABLE GROUP_MESSAGES ADD CONSTRAINT CHK_GRP_MESSAGES_AI_INTEGRITY CHECK (
  (SENDER_TYPE = 'user' AND SENDER_ID IS NOT NULL) OR
  (SENDER_TYPE = 'ai' AND SENDER_ID IS NULL AND AI_AGENT IS NOT NULL)
);

PROMPT Phase 14 AI Message Persistence Schema Migration applied successfully.
