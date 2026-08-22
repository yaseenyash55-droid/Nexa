import { executePostgresSql } from '../../db/postgres.pool.js';
import { ISecurityRepository } from '../types.js';

export class PostgresSecurityRepository implements ISecurityRepository {
  async getSecuritySettings(userId: number): Promise<{
    emailVerifiedAt: Date | null;
    mfaEnabled: boolean;
    totpSecretCiphertext?: string;
    passwordChangedAt?: Date;
    lastProtectionCheckAt?: Date;
  } | null> {
    const sql = `
      SELECT email_verified_at, mfa_enabled, totp_secret_ciphertext, password_changed_at, last_protection_check_at
      FROM user_security_settings
      WHERE user_id = $1
    `;
    const res = await executePostgresSql<{
      email_verified_at?: Date | string | null;
      mfa_enabled: boolean | number;
      totp_secret_ciphertext?: string | null;
      password_changed_at?: Date | string | null;
      last_protection_check_at?: Date | string | null;
    }>(sql, [userId]);

    if (!res.rows || res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      emailVerifiedAt: r.email_verified_at ? new Date(r.email_verified_at) : null,
      mfaEnabled: typeof r.mfa_enabled === 'boolean' ? r.mfa_enabled : Boolean(Number(r.mfa_enabled) > 0),
      totpSecretCiphertext: r.totp_secret_ciphertext ?? undefined,
      passwordChangedAt: r.password_changed_at ? new Date(r.password_changed_at) : undefined,
      lastProtectionCheckAt: r.last_protection_check_at ? new Date(r.last_protection_check_at) : undefined
    };
  }

  async updateSecuritySettings(userId: number, updates: {
    mfaEnabled?: boolean;
    totpSecretCiphertext?: string;
    emailVerifiedAt?: Date;
    passwordChangedAt?: Date;
  }): Promise<void> {
    const sql = `
      INSERT INTO user_security_settings (user_id, mfa_enabled, totp_secret_ciphertext, email_verified_at, password_changed_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) DO UPDATE SET
        mfa_enabled = COALESCE(EXCLUDED.mfa_enabled, user_security_settings.mfa_enabled),
        totp_secret_ciphertext = COALESCE(EXCLUDED.totp_secret_ciphertext, user_security_settings.totp_secret_ciphertext),
        email_verified_at = COALESCE(EXCLUDED.email_verified_at, user_security_settings.email_verified_at),
        password_changed_at = COALESCE(EXCLUDED.password_changed_at, user_security_settings.password_changed_at),
        updated_at = CURRENT_TIMESTAMP
    `;
    await executePostgresSql(sql, [
      userId,
      updates.mfaEnabled ?? false,
      updates.totpSecretCiphertext || null,
      updates.emailVerifiedAt || null,
      updates.passwordChangedAt || null
    ]);
  }

  async createSession(session: {
    sessionId: string;
    userId: number;
    refreshTokenHash: string;
    tokenFamilyId: string;
    deviceName: string;
    userAgentSummary: string;
    ipHash?: string;
    expiresAt: Date;
  }): Promise<void> {
    const sql = `
      INSERT INTO user_sessions (session_id, user_id, refresh_token_hash, token_family_id, device_name, user_agent_summary, ip_hash, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    await executePostgresSql(sql, [
      session.sessionId,
      session.userId,
      session.refreshTokenHash,
      session.tokenFamilyId,
      session.deviceName,
      session.userAgentSummary,
      session.ipHash || null,
      session.expiresAt
    ]);
  }

  async getUserSessions(userId: number): Promise<Array<{
    sessionId: string;
    deviceName: string;
    lastSeenAt: Date;
    isCurrent?: boolean;
  }>> {
    const sql = `
      SELECT session_id, device_name, last_seen_at
      FROM user_sessions
      WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP
      ORDER BY last_seen_at DESC
    `;
    const res = await executePostgresSql<{
      session_id: string;
      device_name?: string | null;
      last_seen_at: Date | string;
    }>(sql, [userId]);

    return (res.rows || []).map((r) => ({
      sessionId: r.session_id,
      deviceName: r.device_name || 'Unknown Device',
      lastSeenAt: new Date(r.last_seen_at),
      isCurrent: false
    }));
  }

  async revokeSession(sessionId: string, userId: number): Promise<boolean> {
    const sql = `
      UPDATE user_sessions
      SET revoked_at = CURRENT_TIMESTAMP, revoke_reason = 'USER_REVOKED'
      WHERE session_id = $1 AND user_id = $2 AND revoked_at IS NULL
    `;
    const res = await executePostgresSql(sql, [sessionId, userId]);
    return res.rowCount > 0;
  }

  async revokeOtherSessions(userId: number, currentSessionId: string): Promise<void> {
    const sql = `
      UPDATE user_sessions
      SET revoked_at = CURRENT_TIMESTAMP, revoke_reason = 'REVOKE_OTHERS'
      WHERE user_id = $1 AND session_id <> $2 AND revoked_at IS NULL
    `;
    await executePostgresSql(sql, [userId, currentSessionId]);
  }

  async logSecurityEvent(event: {
    userId: number;
    sessionId?: string;
    eventType: string;
    outcome: 'SUCCESS' | 'FAILURE';
    deviceSummary?: string;
  }): Promise<void> {
    const sql = `
      INSERT INTO security_events (user_id, session_id, event_type, outcome, device_summary)
      VALUES ($1, $2, $3, $4, $5)
    `;
    await executePostgresSql(sql, [
      event.userId,
      event.sessionId || null,
      event.eventType,
      event.outcome,
      event.deviceSummary || null
    ]);
  }
}
