import pg from 'pg';
import { executePostgresSql } from '../../db/postgres.pool.js';
import { IAuthRepository } from '../types.js';

export class PostgresAuthRepository implements IAuthRepository {
  async saveRefreshToken(userId: number, tokenHash: string, expiresAt: Date): Promise<void> {
    const sql = `
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
    `;
    await executePostgresSql(sql, [userId, tokenHash, expiresAt]);
  }

  async saveRefreshTokenOnConnection(conn: pg.PoolClient, userId: number, tokenHash: string, expiresAt: Date): Promise<void> {
    const sql = `
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
    `;
    await conn.query(sql, [userId, tokenHash, expiresAt]);
  }

  async findRefreshToken(tokenHash: string): Promise<{ userId: number; revokedAt: Date | null; expiresAt: Date } | null> {
    const sql = `
      SELECT user_id, revoked_at, expires_at
      FROM refresh_tokens
      WHERE token_hash = $1
    `;
    const res = await executePostgresSql<{
      user_id: number | string;
      revoked_at?: Date | string | null;
      expires_at: Date | string;
    }>(sql, [tokenHash]);

    if (!res.rows || res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      userId: Number(row.user_id),
      revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
      expiresAt: new Date(row.expires_at)
    };
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    const sql = `
      UPDATE refresh_tokens
      SET revoked_at = CURRENT_TIMESTAMP
      WHERE token_hash = $1 AND revoked_at IS NULL
    `;
    await executePostgresSql(sql, [tokenHash]);
  }

  async revokeAllUserTokens(userId: number): Promise<void> {
    const sql = `
      UPDATE refresh_tokens
      SET revoked_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND revoked_at IS NULL
    `;
    await executePostgresSql(sql, [userId]);
  }

  async savePasswordResetToken(userId: number, tokenHash: string, expiresAt: Date): Promise<void> {
    const sql = `
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
    `;
    await executePostgresSql(sql, [userId, tokenHash, expiresAt]);
  }

  async findPasswordResetToken(tokenHash: string): Promise<{ userId: number; expiresAt: Date; usedAt: Date | null } | null> {
    const sql = `
      SELECT user_id, expires_at, consumed_at
      FROM password_reset_tokens
      WHERE token_hash = $1
    `;
    const res = await executePostgresSql<{
      user_id: number | string;
      expires_at: Date | string;
      consumed_at?: Date | string | null;
    }>(sql, [tokenHash]);

    if (!res.rows || res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      userId: Number(row.user_id),
      expiresAt: new Date(row.expires_at),
      usedAt: row.consumed_at ? new Date(row.consumed_at) : null
    };
  }

  async markPasswordResetTokenUsed(tokenHash: string): Promise<void> {
    const sql = `
      UPDATE password_reset_tokens
      SET consumed_at = CURRENT_TIMESTAMP
      WHERE token_hash = $1 AND consumed_at IS NULL
    `;
    await executePostgresSql(sql, [tokenHash]);
  }

  async saveEmailVerificationToken(userId: number, tokenHash: string, expiresAt: Date): Promise<void> {
    const sql = `
      INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, $3)
    `;
    await executePostgresSql(sql, [userId, tokenHash, expiresAt]);
  }

  async findEmailVerificationToken(tokenHash: string): Promise<{ userId: number; expiresAt: Date; usedAt: Date | null } | null> {
    const sql = `
      SELECT user_id, expires_at, consumed_at
      FROM email_verification_tokens
      WHERE token_hash = $1
    `;
    const res = await executePostgresSql<{
      user_id: number | string;
      expires_at: Date | string;
      consumed_at?: Date | string | null;
    }>(sql, [tokenHash]);

    if (!res.rows || res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      userId: Number(row.user_id),
      expiresAt: new Date(row.expires_at),
      usedAt: row.consumed_at ? new Date(row.consumed_at) : null
    };
  }

  async markEmailVerificationTokenUsed(tokenHash: string): Promise<void> {
    const sql = `
      UPDATE email_verification_tokens
      SET consumed_at = CURRENT_TIMESTAMP
      WHERE token_hash = $1 AND consumed_at IS NULL
    `;
    await executePostgresSql(sql, [tokenHash]);
  }
}
