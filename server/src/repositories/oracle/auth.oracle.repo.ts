import { executeSql } from '../../db/pool.js';
import { IAuthRepository } from '../types.js';

interface RawTokenRow {
  USER_ID: number;
  REVOKED_AT?: Date | null;
  EXPIRES_AT: Date;
}

export class OracleAuthRepository implements IAuthRepository {
  async saveRefreshToken(userId: number, tokenHash: string, expiresAt: Date): Promise<void> {
    const sql = `
      INSERT INTO REFRESH_TOKENS (USER_ID, TOKEN_HASH, EXPIRES_AT)
      VALUES (:userId, :tokenHash, :expiresAt)
    `;
    await executeSql(sql, { userId, tokenHash, expiresAt });
  }

  async findRefreshToken(tokenHash: string): Promise<{ userId: number; revokedAt: Date | null; expiresAt: Date } | null> {
    const sql = `
      SELECT USER_ID, REVOKED_AT, EXPIRES_AT
      FROM REFRESH_TOKENS
      WHERE TOKEN_HASH = :tokenHash
    `;
    const res = await executeSql<RawTokenRow>(sql, { tokenHash });
    if (!res.rows || res.rows.length === 0) return null;

    const row = res.rows[0];
    return {
      userId: row.USER_ID,
      revokedAt: row.REVOKED_AT ? new Date(row.REVOKED_AT) : null,
      expiresAt: new Date(row.EXPIRES_AT)
    };
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    const sql = `
      UPDATE REFRESH_TOKENS SET REVOKED_AT = SYSTIMESTAMP WHERE TOKEN_HASH = :tokenHash
    `;
    await executeSql(sql, { tokenHash });
  }

  async revokeAllUserTokens(userId: number): Promise<void> {
    const sql = `
      UPDATE REFRESH_TOKENS SET REVOKED_AT = SYSTIMESTAMP WHERE USER_ID = :userId AND REVOKED_AT IS NULL
    `;
    await executeSql(sql, { userId });
  }

  async savePasswordResetToken(userId: number, tokenHash: string, expiresAt: Date): Promise<void> {
    const sql = `
      INSERT INTO PASSWORD_RESET_TOKENS (USER_ID, TOKEN_HASH, EXPIRES_AT)
      VALUES (:userId, :tokenHash, :expiresAt)
    `;
    try {
      await executeSql(sql, { userId, tokenHash, expiresAt });
    } catch {
      // Fallback for environments prior to schema migration
    }
  }

  async findPasswordResetToken(tokenHash: string): Promise<{ userId: number; expiresAt: Date; usedAt: Date | null } | null> {
    const sql = `
      SELECT USER_ID, EXPIRES_AT, USED_AT
      FROM PASSWORD_RESET_TOKENS
      WHERE TOKEN_HASH = :tokenHash
    `;
    try {
      const res = await executeSql<{ USER_ID: number; EXPIRES_AT: Date; USED_AT?: Date | null }>(sql, { tokenHash });
      if (!res.rows || res.rows.length === 0) return null;
      const row = res.rows[0];
      return {
        userId: row.USER_ID,
        expiresAt: new Date(row.EXPIRES_AT),
        usedAt: row.USED_AT ? new Date(row.USED_AT) : null
      };
    } catch {
      return null;
    }
  }

  async markPasswordResetTokenUsed(tokenHash: string): Promise<void> {
    const sql = `
      UPDATE PASSWORD_RESET_TOKENS SET USED_AT = SYSTIMESTAMP WHERE TOKEN_HASH = :tokenHash
    `;
    try {
      await executeSql(sql, { tokenHash });
    } catch {
      // Ignore if table not present
    }
  }

  async saveEmailVerificationToken(userId: number, tokenHash: string, expiresAt: Date): Promise<void> {
    const sql = `
      INSERT INTO EMAIL_VERIFICATION_TOKENS (USER_ID, TOKEN_HASH, EXPIRES_AT)
      VALUES (:userId, :tokenHash, :expiresAt)
    `;
    try {
      await executeSql(sql, { userId, tokenHash, expiresAt });
    } catch {
      // Fallback for environments prior to schema migration
    }
  }

  async findEmailVerificationToken(tokenHash: string): Promise<{ userId: number; expiresAt: Date; usedAt: Date | null } | null> {
    const sql = `
      SELECT USER_ID, EXPIRES_AT, USED_AT
      FROM EMAIL_VERIFICATION_TOKENS
      WHERE TOKEN_HASH = :tokenHash
    `;
    try {
      const res = await executeSql<{ USER_ID: number; EXPIRES_AT: Date; USED_AT?: Date | null }>(sql, { tokenHash });
      if (!res.rows || res.rows.length === 0) return null;
      const row = res.rows[0];
      return {
        userId: row.USER_ID,
        expiresAt: new Date(row.EXPIRES_AT),
        usedAt: row.USED_AT ? new Date(row.USED_AT) : null
      };
    } catch {
      return null;
    }
  }

  async markEmailVerificationTokenUsed(tokenHash: string): Promise<void> {
    const sql = `
      UPDATE EMAIL_VERIFICATION_TOKENS SET USED_AT = SYSTIMESTAMP WHERE TOKEN_HASH = :tokenHash
    `;
    try {
      await executeSql(sql, { tokenHash });
    } catch {
      // Ignore if table not present
    }
  }
}
