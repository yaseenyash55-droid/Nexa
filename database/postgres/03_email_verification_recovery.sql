-- Repair/upgrade the hosted PostgreSQL email-verification schema.
-- Safe to run repeatedly from the Supabase SQL Editor.

BEGIN;

CREATE TABLE IF NOT EXISTS user_security_settings (
  user_id                  BIGINT PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  email_verified_at        TIMESTAMPTZ,
  mfa_enabled              BOOLEAN DEFAULT FALSE NOT NULL,
  totp_secret_ciphertext   VARCHAR(512),
  totp_secret_iv           VARCHAR(128),
  totp_secret_auth_tag     VARCHAR(128),
  mfa_key_version          INTEGER DEFAULT 1 NOT NULL,
  password_changed_at      TIMESTAMPTZ,
  last_protection_check_at TIMESTAMPTZ,
  created_at               TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at               TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  token_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token_hash  VARCHAR(256) NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
  consumed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_verification_user_created
  ON email_verification_tokens (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_verification_token_hash
  ON email_verification_tokens (token_hash);

-- These internal tables are accessed only through the trusted server database
-- connection, never directly by browser/mobile Supabase clients.
ALTER TABLE user_security_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;

COMMIT;

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('email_verification_tokens', 'user_security_settings')
ORDER BY table_name;
