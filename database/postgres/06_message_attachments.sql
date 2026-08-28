-- ====================================================================
-- NEXA POSTGRESQL DATABASE SCHEMA MIGRATION
-- FILE: database/postgres/06_message_attachments.sql
-- DESCRIPTION: Add Unified Media and Music Attachments Schema
-- TARGETS: PostgreSQL 14+ / Supabase / Neon / Render PostgreSQL
-- ====================================================================

CREATE TABLE IF NOT EXISTS message_attachments (
  attachment_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  message_id BIGINT REFERENCES messages(message_id) ON DELETE CASCADE,
  group_message_id BIGINT REFERENCES group_messages(message_id) ON DELETE CASCADE,
  broadcast_id BIGINT REFERENCES broadcasts(broadcast_id) ON DELETE CASCADE,
  
  attachment_type VARCHAR(20) NOT NULL CHECK (attachment_type IN ('image', 'video', 'file', 'music', 'gif')),
  
  -- Foreign Key for uploaded media (images, videos, files)
  media_id VARCHAR(36) REFERENCES media_assets(asset_id) ON DELETE SET NULL,
  
  -- Denormalized Metadata for Music/Jamendo to prevent playback failure if track is taken down
  music_provider VARCHAR(30),
  music_track_id VARCHAR(255),
  music_title VARCHAR(255),
  music_artist VARCHAR(255),
  music_artwork_url VARCHAR(1000),
  music_audio_url VARCHAR(1000),
  music_duration INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  
  CONSTRAINT chk_attachment_destination CHECK (
    (message_id IS NOT NULL AND group_message_id IS NULL AND broadcast_id IS NULL) OR
    (message_id IS NULL AND group_message_id IS NOT NULL AND broadcast_id IS NULL) OR
    (message_id IS NULL AND group_message_id IS NULL AND broadcast_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_msg_attachments_msg_id ON message_attachments (message_id) WHERE message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_msg_attachments_group_msg_id ON message_attachments (group_message_id) WHERE group_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_msg_attachments_broadcast_id ON message_attachments (broadcast_id) WHERE broadcast_id IS NOT NULL;
