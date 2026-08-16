import oracledb from 'oracledb';
import { executeSql, withTransaction } from '../../db/pool.js';
import { Reel } from '../../types/index.js';
import { IReelRepository } from '../types.js';

interface RawReelRow {
  REEL_ID: number;
  USER_ID: number;
  USERNAME: string;
  DISPLAY_NAME: string;
  PROFILE_IMAGE_URL?: string | null;
  VIDEO_URL: string;
  CAPTION?: string | null;
  LIKES_COUNT: number;
  IS_LIKED: number;
  CREATED_AT: Date;
}

export class OracleReelRepository implements IReelRepository {
  private mapRow(row: RawReelRow): Reel {
    return {
      reelId: row.REEL_ID,
      userId: row.USER_ID,
      author: {
        userId: row.USER_ID,
        username: row.USERNAME,
        displayName: row.DISPLAY_NAME,
        profileImageUrl: row.PROFILE_IMAGE_URL
      },
      videoUrl: row.VIDEO_URL,
      caption: row.CAPTION,
      likesCount: Number(row.LIKES_COUNT || 0),
      isLiked: Number(row.IS_LIKED || 0) > 0,
      createdAt: row.CREATED_AT.toISOString()
    };
  }

  async createReel(reel: { userId: number; videoUrl: string; caption?: string }): Promise<Reel> {
    const reelId = await withTransaction(async (connection) => {
      const result = await connection.execute(
        `INSERT INTO REELS (USER_ID, VIDEO_URL, CAPTION)
         VALUES (:userId, :videoUrl, :caption)
         RETURNING REEL_ID INTO :reelId`,
        {
          userId: reel.userId,
          videoUrl: reel.videoUrl,
          caption: reel.caption?.trim() || null,
          reelId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
        }
      );
      return Number((result.outBinds as any).reelId[0]);
    });
    const reels = await this.getReels(reel.userId);
    const created = reels.find((item) => item.reelId === reelId);
    if (!created) throw new Error('Reel was committed but could not be reloaded');
    return created;
  }

  async getReels(currentUserId?: number): Promise<Reel[]> {
    const result = await executeSql<RawReelRow>(
      `SELECT r.REEL_ID, r.USER_ID, u.USERNAME, u.DISPLAY_NAME, u.PROFILE_IMAGE_URL,
              r.VIDEO_URL, r.CAPTION, r.CREATED_AT,
              (SELECT COUNT(*) FROM REEL_LIKES rl WHERE rl.REEL_ID = r.REEL_ID) AS LIKES_COUNT,
              (SELECT COUNT(*) FROM REEL_LIKES rl
               WHERE rl.REEL_ID = r.REEL_ID AND rl.USER_ID = :currentUserId) AS IS_LIKED
       FROM REELS r JOIN USERS u ON u.USER_ID = r.USER_ID
       ORDER BY r.CREATED_AT DESC, r.REEL_ID DESC`,
      { currentUserId: currentUserId || -1 }
    );
    return (result.rows || []).map((row: RawReelRow) => this.mapRow(row));
  }

  async likeReel(userId: number, reelId: number): Promise<void> {
    await withTransaction(async (connection) => {
      await connection.execute(
        `MERGE INTO REEL_LIKES target
         USING (SELECT :reelId AS REEL_ID, :userId AS USER_ID FROM DUAL) source
         ON (target.REEL_ID = source.REEL_ID AND target.USER_ID = source.USER_ID)
         WHEN NOT MATCHED THEN INSERT (REEL_ID, USER_ID) VALUES (source.REEL_ID, source.USER_ID)`,
        { reelId, userId }
      );
    });
  }

  async unlikeReel(userId: number, reelId: number): Promise<void> {
    await executeSql(
      'DELETE FROM REEL_LIKES WHERE REEL_ID = :reelId AND USER_ID = :userId',
      { reelId, userId }
    );
  }

  async deleteReel(reelId: number, userId: number): Promise<boolean> {
    const sql = 'DELETE FROM REELS WHERE REEL_ID = :reelId AND USER_ID = :userId';
    const res = await executeSql(sql, { reelId, userId });
    return (res.rowsAffected || 0) > 0;
  }
}
