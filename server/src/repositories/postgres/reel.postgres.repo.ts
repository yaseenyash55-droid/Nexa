import { executePostgresSql } from '../../db/postgres.pool.js';
import { IReelRepository } from '../types.js';
import { Reel } from '../../types/index.js';

interface RawReelRow {
  reel_id: number | string;
  user_id: number | string;
  video_url: string;
  caption?: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  author_username: string;
  author_display_name: string;
  author_profile_image?: string | null;
  likes_count: number | string;
  is_liked?: number | boolean;
}

export class PostgresReelRepository implements IReelRepository {
  private mapRowToReel(row: RawReelRow): Reel {
    return {
      reelId: Number(row.reel_id),
      userId: Number(row.user_id),
      author: {
        userId: Number(row.user_id),
        username: row.author_username,
        displayName: row.author_display_name,
        profileImageUrl: row.author_profile_image ?? undefined
      },
      videoUrl: row.video_url,
      caption: row.caption ?? undefined,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      likesCount: Number(row.likes_count || 0),
      isLiked: Boolean(row.is_liked && Number(row.is_liked) > 0)
    };
  }

  async createReel(reel: { userId: number; videoUrl: string; caption?: string }): Promise<Reel> {
    const sql = `
      INSERT INTO reels (user_id, video_url, caption)
      VALUES ($1, $2, $3)
      RETURNING reel_id, created_at, updated_at
    `;

    const res = await executePostgresSql<{
      reel_id: number | string;
      created_at: Date | string;
      updated_at: Date | string;
    }>(sql, [reel.userId, reel.videoUrl, reel.caption || null]);

    const createdRow = res.rows[0];

    const userRes = await executePostgresSql<{
      username: string;
      display_name: string;
      profile_image_url?: string | null;
    }>(
      'SELECT username, display_name, profile_image_url FROM users WHERE user_id = $1',
      [reel.userId]
    );

    const user = userRes.rows[0] || {
      username: `user_${reel.userId}`,
      display_name: `User ${reel.userId}`,
      profile_image_url: undefined
    };

    return {
      reelId: Number(createdRow.reel_id),
      userId: reel.userId,
      author: {
        userId: reel.userId,
        username: user.username,
        displayName: user.display_name,
        profileImageUrl: user.profile_image_url ?? undefined
      },
      videoUrl: reel.videoUrl,
      caption: reel.caption,
      createdAt: new Date(createdRow.created_at).toISOString(),
      likesCount: 0,
      isLiked: false
    };
  }

  async getReels(currentUserId?: number): Promise<Reel[]> {
    const sql = `
      SELECT r.reel_id, r.user_id, r.video_url, r.caption, r.created_at, r.updated_at,
             u.username AS author_username, u.display_name AS author_display_name, u.profile_image_url AS author_profile_image,
             (SELECT COUNT(*) FROM reel_likes WHERE reel_id = r.reel_id) AS likes_count,
             ${currentUserId ? `(SELECT COUNT(*) FROM reel_likes WHERE reel_id = r.reel_id AND user_id = $1)` : '0'} AS is_liked
      FROM reels r
      JOIN users u ON r.user_id = u.user_id
      ORDER BY r.created_at DESC
      LIMIT 20
    `;
    const params = currentUserId ? [currentUserId] : [];
    const res = await executePostgresSql<RawReelRow>(sql, params);
    return (res.rows || []).map((row) => this.mapRowToReel(row));
  }

  async likeReel(userId: number, reelId: number): Promise<void> {
    const sql = `
      INSERT INTO reel_likes (reel_id, user_id, created_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (reel_id, user_id) DO NOTHING
    `;
    await executePostgresSql(sql, [reelId, userId]);
  }

  async unlikeReel(userId: number, reelId: number): Promise<void> {
    const sql = `DELETE FROM reel_likes WHERE reel_id = $1 AND user_id = $2`;
    await executePostgresSql(sql, [reelId, userId]);
  }

  async deleteReel(reelId: number, userId: number): Promise<boolean> {
    const sql = `DELETE FROM reels WHERE reel_id = $1 AND user_id = $2`;
    const res = await executePostgresSql(sql, [reelId, userId]);
    return res.rowCount > 0;
  }
}
