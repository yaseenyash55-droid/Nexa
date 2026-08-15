import oracledb from 'oracledb';
import { executeSql, withTransaction } from '../../db/pool.js';
import { Story } from '../../types/index.js';
import { IStoryRepository } from '../types.js';

interface RawStoryRow {
  STORY_ID: number;
  USER_ID: number;
  USERNAME: string;
  DISPLAY_NAME: string;
  PROFILE_IMAGE_URL?: string | null;
  MEDIA_URL: string;
  CAPTION?: string | null;
  CREATED_AT: Date;
  EXPIRES_AT: Date;
}

export class OracleStoryRepository implements IStoryRepository {
  private mapRow(row: RawStoryRow): Story {
    return {
      storyId: row.STORY_ID,
      userId: row.USER_ID,
      author: {
        userId: row.USER_ID,
        username: row.USERNAME,
        displayName: row.DISPLAY_NAME,
        profileImageUrl: row.PROFILE_IMAGE_URL
      },
      mediaUrl: row.MEDIA_URL,
      caption: row.CAPTION,
      createdAt: row.CREATED_AT.toISOString(),
      expiresAt: row.EXPIRES_AT.toISOString()
    };
  }

  async createStory(story: { userId: number; mediaUrl: string; caption?: string }): Promise<Story> {
    const storyId = await withTransaction(async (connection) => {
      const result = await connection.execute(
        `INSERT INTO STORIES (USER_ID, MEDIA_URL, CAPTION, EXPIRES_AT)
         VALUES (:userId, :mediaUrl, :caption, SYSTIMESTAMP + INTERVAL '24' HOUR)
         RETURNING STORY_ID INTO :storyId`,
        {
          userId: story.userId,
          mediaUrl: story.mediaUrl,
          caption: story.caption?.trim() || null,
          storyId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
        }
      );
      return Number((result.outBinds as any).storyId[0]);
    });

    const result = await executeSql<RawStoryRow>(
      `SELECT s.STORY_ID, s.USER_ID, u.USERNAME, u.DISPLAY_NAME, u.PROFILE_IMAGE_URL,
              s.MEDIA_URL, s.CAPTION, s.CREATED_AT, s.EXPIRES_AT
       FROM STORIES s JOIN USERS u ON u.USER_ID = s.USER_ID
       WHERE s.STORY_ID = :storyId`,
      { storyId }
    );
    if (!result.rows?.[0]) throw new Error('Story was committed but could not be reloaded');
    return this.mapRow(result.rows[0]);
  }

  async getFeedStories(userId?: number): Promise<Story[]> {
    const result = await executeSql<RawStoryRow>(
      `SELECT s.STORY_ID, s.USER_ID, u.USERNAME, u.DISPLAY_NAME, u.PROFILE_IMAGE_URL,
              s.MEDIA_URL, s.CAPTION, s.CREATED_AT, s.EXPIRES_AT
       FROM STORIES s JOIN USERS u ON u.USER_ID = s.USER_ID
       WHERE s.EXPIRES_AT > SYSTIMESTAMP
         AND (:userId IS NULL OR s.USER_ID = :userId OR EXISTS (
           SELECT 1 FROM FOLLOWERS f
           WHERE f.FOLLOWER_ID = :userId AND f.FOLLOWING_ID = s.USER_ID
         ))
       ORDER BY s.CREATED_AT DESC`,
      { userId: userId || null }
    );
    return (result.rows || []).map((row: RawStoryRow) => this.mapRow(row));
  }

  async deleteStory(storyId: number, userId: number): Promise<boolean> {
    const result = await executeSql(
      'DELETE FROM STORIES WHERE STORY_ID = :storyId AND USER_ID = :userId',
      { storyId, userId }
    );
    return Number(result.rowsAffected || 0) === 1;
  }
}
