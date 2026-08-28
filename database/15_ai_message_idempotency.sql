-- 15_ai_message_idempotency.sql
-- Additive migration for durable database-level idempotency of @nexa AI assistant replies
-- Ensures exactly one AI response per triggering human message across multi-instance restarts

-- ==========================================================
-- 1. DIRECT MESSAGES TABLE (MESSAGES)
-- ==========================================================
ALTER TABLE MESSAGES ADD (
  TRIGGER_MESSAGE_ID NUMBER
);

-- Foreign key linking the AI reply to the original triggering human message
ALTER TABLE MESSAGES ADD CONSTRAINT FK_MESSAGES_TRIGGER_MSG
  FOREIGN KEY (TRIGGER_MESSAGE_ID) REFERENCES MESSAGES(MESSAGE_ID) ON DELETE SET NULL;

-- Unique constraint ensuring at most 1 AI response per agent per triggering message
CREATE UNIQUE INDEX UQ_MESSAGES_TRIGGER_AI ON MESSAGES (
  CASE WHEN TRIGGER_MESSAGE_ID IS NOT NULL AND SENDER_TYPE = 'ai' THEN TRIGGER_MESSAGE_ID END,
  CASE WHEN TRIGGER_MESSAGE_ID IS NOT NULL AND SENDER_TYPE = 'ai' THEN AI_AGENT END
);

-- ==========================================================
-- 2. GROUP MESSAGES TABLE (GROUP_MESSAGES)
-- ==========================================================
ALTER TABLE GROUP_MESSAGES ADD (
  TRIGGER_MESSAGE_ID NUMBER
);

-- Foreign key linking the AI group reply to the original triggering human group message
ALTER TABLE GROUP_MESSAGES ADD CONSTRAINT FK_GRP_MESSAGES_TRIGGER_MSG
  FOREIGN KEY (TRIGGER_MESSAGE_ID) REFERENCES GROUP_MESSAGES(MESSAGE_ID) ON DELETE SET NULL;

-- Unique constraint ensuring at most 1 AI response per agent per triggering group message
CREATE UNIQUE INDEX UQ_GRP_MESSAGES_TRIGGER_AI ON GROUP_MESSAGES (
  CASE WHEN TRIGGER_MESSAGE_ID IS NOT NULL AND SENDER_TYPE = 'ai' THEN TRIGGER_MESSAGE_ID END,
  CASE WHEN TRIGGER_MESSAGE_ID IS NOT NULL AND SENDER_TYPE = 'ai' THEN AI_AGENT END
);

PROMPT Phase 15 AI Message Idempotency Migration applied successfully.
