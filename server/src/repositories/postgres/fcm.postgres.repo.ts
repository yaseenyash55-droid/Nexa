import { executePostgresSql } from '../../db/postgres.pool.js';
import { IFcmTokenRepository } from '../types.js';

export class PostgresFcmTokenRepository implements IFcmTokenRepository {
  async upsertToken(userId: number, token: string, platform = 'android', deviceId?: string): Promise<void> {
    const sql = `
      INSERT INTO fcm_tokens (user_id, token, platform, device_id, updated_at)
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (token) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        platform = EXCLUDED.platform,
        device_id = EXCLUDED.device_id,
        updated_at = CURRENT_TIMESTAMP
    `;
    await executePostgresSql(sql, [userId, token, platform, deviceId || null]);
  }

  async revokeToken(token: string, userId?: number): Promise<boolean> {
    let sql = `DELETE FROM fcm_tokens WHERE token = $1`;
    const params: any[] = [token];
    if (userId) {
      sql += ` AND user_id = $2`;
      params.push(userId);
    }
    const result = await executePostgresSql(sql, params);
    return result.rowCount > 0;
  }

  async revokeUserTokens(userId: number): Promise<number> {
    const sql = `DELETE FROM fcm_tokens WHERE user_id = $1`;
    const result = await executePostgresSql(sql, [userId]);
    return result.rowCount;
  }

  async getUserTokens(userId: number): Promise<string[]> {
    const sql = `SELECT token FROM fcm_tokens WHERE user_id = $1 ORDER BY updated_at DESC`;
    const result = await executePostgresSql<{ token: string }>(sql, [userId]);
    return (result.rows || []).map((r) => r.token);
  }
}
