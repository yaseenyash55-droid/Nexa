import { executePostgresSql } from '../../db/postgres.pool.js';
import { IStoryRepository } from '../types.js';
import { Story } from '../../types/index.js';

interface RawStoryRow {
  story_id: number | string;
  user_id: number | string;
  media_url: string;
  caption?: string | null;
  created_at: Date | string;
  expires_at: Date | string;
  author_username: string;
  author_display_name: string;
  author_profile_image?: string | null;
}

export class PostgresStoryRepository implements IStoryRepository {
  private mapRowToStory(row: RawStoryRow): Story {
    return {
      storyId: Number(row.story_id),
      userId: Number(row.user_id),
      author: {
        userId: Number(row.user_id),
        username: row.author_username,
        displayName: row.author_display_name,
        profileImageUrl: row.author_profile_image ?? undefined
      },
      mediaUrl: row.media_url,
      caption: row.caption ?? undefined,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : new Date().toISOString()
    };
  }

  async createStory(story: { userId: number; mediaUrl: string; caption?: string }): Promise<Story> {
    const sql = `
      INSERT INTO stories (user_id, media_url, caption, expires_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP + INTERVAL '24 hours')
      RETURNING story_id, created_at, expires_at
    `;

    const res = await executePostgresSql<{
      story_id: number | string;
      created_at: Date | string;
      expires_at: Date | string;
    }>(sql, [
      story.userId,
      story.mediaUrl,
      story.caption || null
    ]);

    const createdRow = res.rows[0];

    const userRes = await executePostgresSql<{
      username: string;
      display_name: string;
      profile_image_url?: string | null;
    }>(
      'SELECT username, display_name, profile_image_url FROM users WHERE user_id = $1',
      [story.userId]
    );

    const user = userRes.rows[0] || {
      username: `user_${story.userId}`,
      display_name: `User ${story.userId}`,
      profile_image_url: undefined
    };

    return {
      storyId: Number(createdRow.story_id),
      userId: story.userId,
      author: {
        userId: story.userId,
        username: user.username,
        displayName: user.display_name,
        profileImageUrl: user.profile_image_url ?? undefined
      },
      mediaUrl: story.mediaUrl,
      caption: story.caption,
      createdAt: new Date(createdRow.created_at).toISOString(),
      expiresAt: new Date(createdRow.expires_at).toISOString()
    };
  }

  async getFeedStories(userId?: number): Promise<Story[]> {
    const sql = `
      SELECT s.story_id, s.user_id, s.media_url, s.caption, s.created_at, s.expires_at,
             u.username AS author_username, u.display_name AS author_display_name, u.profile_image_url AS author_profile_image
      FROM stories s
      JOIN users u ON s.user_id = u.user_id
      WHERE s.expires_at > CURRENT_TIMESTAMP
      ${userId ? `AND (s.user_id = $1 OR s.user_id IN (SELECT following_id FROM followers WHERE follower_id = $1))` : ''}
      ORDER BY s.created_at ASC
    `;
    const params = userId ? [userId] : [];
    const res = await executePostgresSql<RawStoryRow>(sql, params);
    return (res.rows || []).map((row) => this.mapRowToStory(row));
  }

  async deleteStory(storyId: number, userId: number): Promise<boolean> {
    const sql = `DELETE FROM stories WHERE story_id = $1 AND user_id = $2`;
    const res = await executePostgresSql(sql, [storyId, userId]);
    return res.rowCount > 0;
  }
}
