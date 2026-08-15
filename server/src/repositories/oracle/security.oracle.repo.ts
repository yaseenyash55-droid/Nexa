import { executeSql } from '../../db/pool.js';
import { ISecurityRepository } from '../types.js';

export class OracleSecurityRepository implements ISecurityRepository {
  async getSecuritySettings(userId: number) {
    const sql = `
      SELECT USER_ID, EMAIL_VERIFIED_AT, MFA_ENABLED, TOTP_SECRET_CIPHERTEXT, 
             PASSWORD_CHANGED_AT, LAST_PROTECTION_CHECK_AT
      FROM USER_SECURITY_SETTINGS
      WHERE USER_ID = :userId
    `;
    const res = await executeSql<any>(sql, { userId });
    if (!res.rows || res.rows.length === 0) {
      return null;
    }
    const row = res.rows[0];
    return {
      emailVerifiedAt: row.EMAIL_VERIFIED_AT || null,
      mfaEnabled: Boolean(row.MFA_ENABLED === 1),
      totpSecretCiphertext: row.TOTP_SECRET_CIPHERTEXT || undefined,
      passwordChangedAt: row.PASSWORD_CHANGED_AT || undefined,
      lastProtectionCheckAt: row.LAST_PROTECTION_CHECK_AT || undefined
    };
  }

  async updateSecuritySettings(userId: number, updates: {
    mfaEnabled?: boolean;
    totpSecretCiphertext?: string;
    emailVerifiedAt?: Date;
    passwordChangedAt?: Date;
  }): Promise<void> {
    const sql = `
      MERGE INTO USER_SECURITY_SETTINGS s
      USING (SELECT :userId AS USER_ID FROM DUAL) src
      ON (s.USER_ID = src.USER_ID)
      WHEN MATCHED THEN
        UPDATE SET MFA_ENABLED = :mfaEnabled, UPDATED_AT = SYSTIMESTAMP
      WHEN NOT MATCHED THEN
        INSERT (USER_ID, MFA_ENABLED, CREATED_AT, UPDATED_AT)
        VALUES (src.USER_ID, :mfaEnabled, SYSTIMESTAMP, SYSTIMESTAMP)
    `;
    await executeSql(sql, { userId, mfaEnabled: updates.mfaEnabled ? 1 : 0 });
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
      INSERT INTO USER_SESSIONS (SESSION_ID, USER_ID, REFRESH_TOKEN_HASH, TOKEN_FAMILY_ID, DEVICE_NAME, EXPIRES_AT)
      VALUES (:sessionId, :userId, :tokenHash, :familyId, :deviceName, SYSTIMESTAMP + INTERVAL '7' DAY)
    `;
    await executeSql(sql, {
      sessionId: session.sessionId,
      userId: session.userId,
      tokenHash: session.refreshTokenHash,
      familyId: session.tokenFamilyId,
      deviceName: session.deviceName || 'Web Browser'
    });
  }

  async getUserSessions(userId: number) {
    const sql = `
      SELECT SESSION_ID, DEVICE_NAME, LAST_SEEN_AT
      FROM USER_SESSIONS
      WHERE USER_ID = :userId AND REVOKED_AT IS NULL
      ORDER BY LAST_SEEN_AT DESC
    `;
    const res = await executeSql<any>(sql, { userId });
    return (res.rows || []).map((row: any) => ({
      sessionId: row.SESSION_ID,
      deviceName: row.DEVICE_NAME || 'Unknown Device',
      lastSeenAt: row.LAST_SEEN_AT || new Date(),
      isCurrent: false
    }));
  }

  async revokeSession(sessionId: string, userId: number): Promise<boolean> {
    const sql = `
      UPDATE USER_SESSIONS 
      SET REVOKED_AT = SYSTIMESTAMP, REVOKE_REASON = 'USER_REVOKED'
      WHERE SESSION_ID = :sessionId AND USER_ID = :userId
    `;
    await executeSql(sql, { sessionId, userId });
    return true;
  }

  async revokeOtherSessions(userId: number, currentSessionId: string): Promise<void> {
    const sql = `
      UPDATE USER_SESSIONS 
      SET REVOKED_AT = SYSTIMESTAMP, REVOKE_REASON = 'REVOKE_OTHERS'
      WHERE USER_ID = :userId AND SESSION_ID <> :currentSessionId AND REVOKED_AT IS NULL
    `;
    await executeSql(sql, { userId, currentSessionId });
  }

  async logSecurityEvent(event: {
    userId: number;
    sessionId?: string;
    eventType: string;
    outcome: 'SUCCESS' | 'FAILURE';
    deviceSummary?: string;
  }): Promise<void> {
    const sql = `
      INSERT INTO SECURITY_EVENTS (USER_ID, SESSION_ID, EVENT_TYPE, OUTCOME, DEVICE_SUMMARY, CREATED_AT)
      VALUES (:userId, :sessionId, :eventType, :outcome, :deviceSummary, SYSTIMESTAMP)
    `;
    await executeSql(sql, {
      userId: event.userId,
      sessionId: event.sessionId || null,
      eventType: event.eventType,
      outcome: event.outcome,
      deviceSummary: event.deviceSummary || null
    });
  }
}
