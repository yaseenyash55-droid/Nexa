import oracledb from 'oracledb';
import { executeSql } from '../../db/pool.js';
import { IAuthRepository } from '../types.js';

export class OracleAuthRepository implements IAuthRepository {
  async saveRefreshToken(userId: number, tokenHash: string, expiresAt: Date): Promise<void> {
    const sql = `
      INSERT INTO REFRESH_TOKENS (USER_ID, TOKEN_HASH, EXPIRES_AT)
      VALUES (:userId, :tokenHash, :expiresAt)
    `;
    await executeSql(sql, { userId, tokenHash, expiresAt });
  }

  /**
   * Connection-aware variant — executes on the given connection without
   * auto-commit so the caller can wrap it in a transaction.
   */
  async saveRefreshTokenOnConnection(conn: any, userId: number, tokenHash: string, expiresAt: Date): Promise<void> {
    const sql = `
      INSERT INTO REFRESH_TOKENS (USER_ID, TOKEN_HASH, EXPIRES_AT)
      VALUES (:userId, :tokenHash, :expiresAt)
    `;
    await conn.execute(sql, { userId, tokenHash, expiresAt }, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
      autoCommit: false
    });
  }

  async findRefreshToken(tokenHash: string): Promise<{ userId: number; revokedAt: Date | null; expiresAt: Date } | null> {
    const sql = `
      SELECT TOKEN_ID, USER_ID, TOKEN_HASH, EXPIRES_AT, CREATED_AT, REVOKED_AT
      FROM REFRESH_TOKENS
      WHERE TOKEN_HASH = :tokenHash
    `;
    const res = await executeSql<{
      TOKEN_ID: number;
      USER_ID: number;
      TOKEN_HASH: string;
      EXPIRES_AT: Date;
      CREATED_AT: Date;
      REVOKED_AT: Date | null;
    }>(sql, { tokenHash });

    if (!res.rows || res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      userId: row.USER_ID,
      expiresAt: new Date(row.EXPIRES_AT),
      revokedAt: row.REVOKED_AT ? new Date(row.REVOKED_AT) : null
    };
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    const sql = `
      UPDATE REFRESH_TOKENS
      SET REVOKED_AT = SYSTIMESTAMP
      WHERE TOKEN_HASH = :tokenHash AND REVOKED_AT IS NULL
    `;
    await executeSql(sql, { tokenHash });
  }

  async revokeAllUserTokens(userId: number): Promise<void> {
    const sql = `
      UPDATE REFRESH_TOKENS
      SET REVOKED_AT = SYSTIMESTAMP
      WHERE USER_ID = :userId AND REVOKED_AT IS NULL
    `;
    await executeSql(sql, { userId });
  }

  async revokeAllUserRefreshTokens(userId: number): Promise<void> {
    await this.revokeAllUserTokens(userId);
  }

  async savePasswordResetToken(userId: number, tokenHash: string, expiresAt: Date): Promise<void> {
    const sql = `
      INSERT INTO PASSWORD_RESET_TOKENS (USER_ID, TOKEN_HASH, EXPIRES_AT)
      VALUES (:userId, :tokenHash, :expiresAt)
    `;
    await executeSql(sql, { userId, tokenHash, expiresAt });
  }

  async findPasswordResetToken(tokenHash: string): Promise<{ userId: number; expiresAt: Date; usedAt: Date | null } | null> {
    const sql = `
      SELECT USER_ID, EXPIRES_AT, CONSUMED_AT
      FROM PASSWORD_RESET_TOKENS
      WHERE TOKEN_HASH = :tokenHash
    `;
    const res = await executeSql<{ USER_ID: number; EXPIRES_AT: Date; CONSUMED_AT?: Date | null }>(sql, { tokenHash });
    if (!res.rows || res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      userId: row.USER_ID,
      expiresAt: new Date(row.EXPIRES_AT),
      usedAt: row.CONSUMED_AT ? new Date(row.CONSUMED_AT) : null
    };
  }

  async markPasswordResetTokenUsed(tokenHash: string): Promise<void> {
    const sql = `
      UPDATE PASSWORD_RESET_TOKENS SET CONSUMED_AT = SYSTIMESTAMP WHERE TOKEN_HASH = :tokenHash
    `;
    await executeSql(sql, { tokenHash });
  }

  async saveEmailVerificationToken(userId: number, tokenHash: string, expiresAt: Date): Promise<void> {
    const sql = `
      INSERT INTO EMAIL_VERIFICATION_TOKENS (USER_ID, TOKEN_HASH, EXPIRES_AT)
      VALUES (:userId, :tokenHash, :expiresAt)
    `;
    await executeSql(sql, { userId, tokenHash, expiresAt });
  }

  async findEmailVerificationToken(tokenHash: string): Promise<{ userId: number; expiresAt: Date; usedAt: Date | null } | null> {
    const sql = `
      SELECT USER_ID, EXPIRES_AT, CONSUMED_AT
      FROM EMAIL_VERIFICATION_TOKENS
      WHERE TOKEN_HASH = :tokenHash
    `;
    const res = await executeSql<{ USER_ID: number; EXPIRES_AT: Date; CONSUMED_AT?: Date | null }>(sql, { tokenHash });
    if (!res.rows || res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      userId: row.USER_ID,
      expiresAt: new Date(row.EXPIRES_AT),
      usedAt: row.CONSUMED_AT ? new Date(row.CONSUMED_AT) : null
    };
  }

  async markEmailVerificationTokenUsed(tokenHash: string): Promise<void> {
    const sql = `
      UPDATE EMAIL_VERIFICATION_TOKENS SET CONSUMED_AT = SYSTIMESTAMP WHERE TOKEN_HASH = :tokenHash
    `;
    await executeSql(sql, { tokenHash });
  }
}
