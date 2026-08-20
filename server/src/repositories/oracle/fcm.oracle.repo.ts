import { IFcmTokenRepository } from '../types.js';
import { executeSql } from '../../db/pool.js';
import { logger } from '../../utils/logger.js';

export class OracleFcmTokenRepository implements IFcmTokenRepository {
  async upsertToken(userId: number, token: string, platform: string = 'android', deviceId?: string): Promise<void> {
    const validPlatforms = ['android', 'ios', 'web'];
    const safePlatform = validPlatforms.includes(platform.toLowerCase()) ? platform.toLowerCase() : 'android';

    const sql = `
      MERGE INTO FCM_TOKENS t
      USING (
        SELECT :userId AS USER_ID, :token AS TOKEN, :platform AS PLATFORM, :deviceId AS DEVICE_ID FROM DUAL
      ) src
      ON (t.TOKEN = src.TOKEN)
      WHEN MATCHED THEN
        UPDATE SET t.USER_ID = src.USER_ID, t.PLATFORM = src.PLATFORM, t.DEVICE_ID = src.DEVICE_ID, t.UPDATED_AT = SYSTIMESTAMP
      WHEN NOT MATCHED THEN
        INSERT (USER_ID, TOKEN, PLATFORM, DEVICE_ID, CREATED_AT, UPDATED_AT)
        VALUES (src.USER_ID, src.TOKEN, src.PLATFORM, src.DEVICE_ID, SYSTIMESTAMP, SYSTIMESTAMP)
    `;

    await executeSql(sql, {
      userId,
      token,
      platform: safePlatform,
      deviceId: deviceId || null
    });
    // Explicitly NEVER log raw token values
    logger.info({ userId, platform: safePlatform }, 'FCM token registered/upserted successfully');
  }

  async revokeToken(token: string, userId?: number): Promise<boolean> {
    let sql = 'DELETE FROM FCM_TOKENS WHERE TOKEN = :token';
    const binds: any = { token };
    if (userId) {
      sql += ' AND USER_ID = :userId';
      binds.userId = userId;
    }
    const result = await executeSql(sql, binds);
    const rowsAffected = result.rowsAffected || 0;
    logger.info({ userId, rowsAffected }, 'FCM token revocation executed');
    return rowsAffected > 0;
  }

  async revokeUserTokens(userId: number): Promise<number> {
    const sql = 'DELETE FROM FCM_TOKENS WHERE USER_ID = :userId';
    const result = await executeSql(sql, { userId });
    const rowsAffected = result.rowsAffected || 0;
    logger.info({ userId, rowsAffected }, 'All FCM tokens for user revoked');
    return rowsAffected;
  }

  async getUserTokens(userId: number): Promise<string[]> {
    const sql = 'SELECT TOKEN FROM FCM_TOKENS WHERE USER_ID = :userId';
    const result = await executeSql<{ TOKEN: string }>(sql, { userId });
    return (result.rows || []).map((r: any) => r.TOKEN);
  }
}
