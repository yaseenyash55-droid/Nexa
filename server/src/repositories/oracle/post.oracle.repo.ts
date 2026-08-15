import oracledb from 'oracledb';
import { executeSql } from '../../db/pool.js';
import { IPostRepository } from '../types.js';
import { Post, PaginatedResult } from '../../types/index.js';

interface RawPostRow {
  POST_ID: number;
  USER_ID: number;
  CONTENT?: string | null;
  IMAGE_URL?: string | null;
  CREATED_AT: Date;
  UPDATED_AT: Date;
  AUTHOR_USERNAME: string;
  AUTHOR_DISPLAY_NAME: string;
  AUTHOR_PROFILE_IMAGE?: string | null;
  LIKES_COUNT: number;
  COMMENTS_COUNT: number;
  IS_LIKED?: number;
  IS_BOOKMARKED?: number;
}

export class OraclePostRepository implements IPostRepository {
  private mapRowToPost(row: RawPostRow): Post {
    return {
      postId: row.POST_ID,
      userId: row.USER_ID,
      author: {
        userId: row.USER_ID,
        username: row.AUTHOR_USERNAME,
        displayName: row.AUTHOR_DISPLAY_NAME,
        profileImageUrl: row.AUTHOR_PROFILE_IMAGE
      },
      content: row.CONTENT,
      imageUrl: row.IMAGE_URL,
      createdAt: row.CREATED_AT ? row.CREATED_AT.toISOString() : new Date().toISOString(),
      updatedAt: row.UPDATED_AT ? row.UPDATED_AT.toISOString() : new Date().toISOString(),
      likesCount: Number(row.LIKES_COUNT || 0),
      commentsCount: Number(row.COMMENTS_COUNT || 0),
      isLiked: Boolean(row.IS_LIKED && row.IS_LIKED > 0),
      isBookmarked: Boolean(row.IS_BOOKMARKED && row.IS_BOOKMARKED > 0)
    };
  }

  async createPost(post: {
    userId: number;
    content?: string;
    imageUrl?: string;
  }): Promise<Post> {
    if (!post.content?.trim() && !post.imageUrl?.trim()) {
      throw new Error('Post must contain either text content or an image URL');
    }

    const sql = `
      INSERT INTO POSTS (USER_ID, CONTENT, IMAGE_URL)
      VALUES (:userId, :content, :imageUrl)
      RETURNING POST_ID INTO :postId
    `;

    let safeImageUrl: string | null = post.imageUrl?.trim() || null;
    if (safeImageUrl && safeImageUrl.length > 2000 && !safeImageUrl.startsWith('http') && !safeImageUrl.startsWith('/')) {
      // Base64 payload passed without disk upload conversion; safely limit length
      safeImageUrl = safeImageUrl.substring(0, 2000);
    }

    const binds = {
      userId: post.userId,
      content: post.content?.trim() || null,
      imageUrl: safeImageUrl,
      postId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
    };

    const res = await executeSql<never>(sql, binds);
    const newPostId = (res.outBinds as any).postId[0];

    const created = await this.findById(newPostId, post.userId);
    if (!created) throw new Error('Failed to retrieve newly created post');
    return created;
  }

  async findById(postId: number, currentUserId?: number): Promise<Post | null> {
    const sql = `
      SELECT p.POST_ID, p.USER_ID, p.CONTENT, p.IMAGE_URL, p.CREATED_AT, p.UPDATED_AT,
             u.USERNAME AS AUTHOR_USERNAME, u.DISPLAY_NAME AS AUTHOR_DISPLAY_NAME, u.PROFILE_IMAGE_URL AS AUTHOR_PROFILE_IMAGE,
             (SELECT COUNT(*) FROM LIKES WHERE POST_ID = p.POST_ID) AS LIKES_COUNT,
             (SELECT COUNT(*) FROM COMMENTS WHERE POST_ID = p.POST_ID) AS COMMENTS_COUNT,
             ${currentUserId ? `(SELECT COUNT(*) FROM LIKES WHERE POST_ID = p.POST_ID AND USER_ID = :currentUserId)` : '0'} AS IS_LIKED,
             ${currentUserId ? `(SELECT COUNT(*) FROM BOOKMARKS WHERE POST_ID = p.POST_ID AND USER_ID = :currentUserId)` : '0'} AS IS_BOOKMARKED
      FROM POSTS p
      JOIN USERS u ON p.USER_ID = u.USER_ID
      WHERE p.POST_ID = :postId
    `;
    const binds: Record<string, any> = { postId };
    if (currentUserId) binds.currentUserId = currentUserId;

    const res = await executeSql<RawPostRow>(sql, binds);
    if (!res.rows || res.rows.length === 0) return null;
    return this.mapRowToPost(res.rows[0]);
  }

  async updatePost(postId: number, data: { content?: string }): Promise<Post> {
    const sql = `UPDATE POSTS SET CONTENT = :content, UPDATED_AT = SYSTIMESTAMP WHERE POST_ID = :postId`;
    await executeSql(sql, { content: data.content || null, postId });
    const updated = await this.findById(postId);
    if (!updated) throw new Error('Post not found after update');
    return updated;
  }

  async deletePost(postId: number, userId: number): Promise<boolean> {
    const sql = `DELETE FROM POSTS WHERE POST_ID = :postId AND USER_ID = :userId`;
    const res = await executeSql(sql, { postId, userId });
    return (res.rowsAffected || 0) > 0;
  }

  async getGlobalFeed(currentUserId?: number, cursor?: number, limit = 10): Promise<PaginatedResult<Post>> {
    const sql = `
      SELECT p.POST_ID, p.USER_ID, p.CONTENT, p.IMAGE_URL, p.CREATED_AT, p.UPDATED_AT,
             u.USERNAME AS AUTHOR_USERNAME, u.DISPLAY_NAME AS AUTHOR_DISPLAY_NAME, u.PROFILE_IMAGE_URL AS AUTHOR_PROFILE_IMAGE,
             (SELECT COUNT(*) FROM LIKES WHERE POST_ID = p.POST_ID) AS LIKES_COUNT,
             (SELECT COUNT(*) FROM COMMENTS WHERE POST_ID = p.POST_ID) AS COMMENTS_COUNT,
             ${currentUserId ? `(SELECT COUNT(*) FROM LIKES WHERE POST_ID = p.POST_ID AND USER_ID = :currentUserId)` : '0'} AS IS_LIKED,
             ${currentUserId ? `(SELECT COUNT(*) FROM BOOKMARKS WHERE POST_ID = p.POST_ID AND USER_ID = :currentUserId)` : '0'} AS IS_BOOKMARKED
      FROM POSTS p
      JOIN USERS u ON p.USER_ID = u.USER_ID
      ${cursor ? `WHERE p.POST_ID < :cursor` : ''}
      ORDER BY p.POST_ID DESC
      FETCH NEXT :fetchLimit ROWS ONLY
    `;
    const binds: Record<string, any> = { fetchLimit: limit + 1 };
    if (cursor) binds.cursor = cursor;
    if (currentUserId) binds.currentUserId = currentUserId;

    const res = await executeSql<RawPostRow>(sql, binds);
    const rows = res.rows || [];
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const posts = items.map((row: RawPostRow) => this.mapRowToPost(row));
    const nextCursor = hasMore && posts.length > 0 ? posts[posts.length - 1].postId : null;

    return { data: posts, nextCursor, hasMore };
  }

  async getFollowingFeed(userId: number, cursor?: number, limit = 10): Promise<PaginatedResult<Post>> {
    const sql = `
      SELECT p.POST_ID, p.USER_ID, p.CONTENT, p.IMAGE_URL, p.CREATED_AT, p.UPDATED_AT,
             u.USERNAME AS AUTHOR_USERNAME, u.DISPLAY_NAME AS AUTHOR_DISPLAY_NAME, u.PROFILE_IMAGE_URL AS AUTHOR_PROFILE_IMAGE,
             (SELECT COUNT(*) FROM LIKES WHERE POST_ID = p.POST_ID) AS LIKES_COUNT,
             (SELECT COUNT(*) FROM COMMENTS WHERE POST_ID = p.POST_ID) AS COMMENTS_COUNT,
             (SELECT COUNT(*) FROM LIKES WHERE POST_ID = p.POST_ID AND USER_ID = :userId) AS IS_LIKED,
             (SELECT COUNT(*) FROM BOOKMARKS WHERE POST_ID = p.POST_ID AND USER_ID = :userId) AS IS_BOOKMARKED
      FROM POSTS p
      JOIN USERS u ON p.USER_ID = u.USER_ID
      WHERE (p.USER_ID = :userId OR p.USER_ID IN (SELECT FOLLOWING_ID FROM FOLLOWERS WHERE FOLLOWER_ID = :userId))
        ${cursor ? `AND p.POST_ID < :cursor` : ''}
      ORDER BY p.POST_ID DESC
      FETCH NEXT :fetchLimit ROWS ONLY
    `;
    const binds: Record<string, any> = { userId, fetchLimit: limit + 1 };
    if (cursor) binds.cursor = cursor;

    const res = await executeSql<RawPostRow>(sql, binds);
    const rows = res.rows || [];
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const posts = items.map((row: RawPostRow) => this.mapRowToPost(row));
    const nextCursor = hasMore && posts.length > 0 ? posts[posts.length - 1].postId : null;

    return { data: posts, nextCursor, hasMore };
  }

  async getUserPosts(userId: number, currentUserId?: number, cursor?: number, limit = 10): Promise<PaginatedResult<Post>> {
    const sql = `
      SELECT p.POST_ID, p.USER_ID, p.CONTENT, p.IMAGE_URL, p.CREATED_AT, p.UPDATED_AT,
             u.USERNAME AS AUTHOR_USERNAME, u.DISPLAY_NAME AS AUTHOR_DISPLAY_NAME, u.PROFILE_IMAGE_URL AS AUTHOR_PROFILE_IMAGE,
             (SELECT COUNT(*) FROM LIKES WHERE POST_ID = p.POST_ID) AS LIKES_COUNT,
             (SELECT COUNT(*) FROM COMMENTS WHERE POST_ID = p.POST_ID) AS COMMENTS_COUNT,
             ${currentUserId ? `(SELECT COUNT(*) FROM LIKES WHERE POST_ID = p.POST_ID AND USER_ID = :currentUserId)` : '0'} AS IS_LIKED,
             ${currentUserId ? `(SELECT COUNT(*) FROM BOOKMARKS WHERE POST_ID = p.POST_ID AND USER_ID = :currentUserId)` : '0'} AS IS_BOOKMARKED
      FROM POSTS p
      JOIN USERS u ON p.USER_ID = u.USER_ID
      WHERE p.USER_ID = :targetUserId
        ${cursor ? `AND p.POST_ID < :cursor` : ''}
      ORDER BY p.POST_ID DESC
      FETCH NEXT :fetchLimit ROWS ONLY
    `;
    const binds: Record<string, any> = { targetUserId: userId, fetchLimit: limit + 1 };
    if (cursor) binds.cursor = cursor;
    if (currentUserId) binds.currentUserId = currentUserId;

    const res = await executeSql<RawPostRow>(sql, binds);
    const rows = res.rows || [];
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const posts = items.map((row: RawPostRow) => this.mapRowToPost(row));
    const nextCursor = hasMore && posts.length > 0 ? posts[posts.length - 1].postId : null;

    return { data: posts, nextCursor, hasMore };
  }

  async likePost(userId: number, postId: number): Promise<void> {
    const sql = `
      MERGE INTO LIKES l
      USING (SELECT :postId AS POST_ID, :userId AS USER_ID FROM DUAL) src
      ON (l.POST_ID = src.POST_ID AND l.USER_ID = src.USER_ID)
      WHEN NOT MATCHED THEN
        INSERT (POST_ID, USER_ID, CREATED_AT)
        VALUES (src.POST_ID, src.USER_ID, SYSTIMESTAMP)
    `;
    await executeSql(sql, { postId, userId });
  }

  async unlikePost(userId: number, postId: number): Promise<void> {
    const sql = `DELETE FROM LIKES WHERE POST_ID = :postId AND USER_ID = :userId`;
    await executeSql(sql, { postId, userId });
  }

  async bookmarkPost(userId: number, postId: number): Promise<void> {
    const sql = `
      MERGE INTO BOOKMARKS b
      USING (SELECT :userId AS USER_ID, :postId AS POST_ID FROM DUAL) src
      ON (b.USER_ID = src.USER_ID AND b.POST_ID = src.POST_ID)
      WHEN NOT MATCHED THEN
        INSERT (USER_ID, POST_ID, CREATED_AT)
        VALUES (src.USER_ID, src.POST_ID, SYSTIMESTAMP)
    `;
    await executeSql(sql, { userId, postId });
  }

  async unbookmarkPost(userId: number, postId: number): Promise<void> {
    const sql = `DELETE FROM BOOKMARKS WHERE USER_ID = :userId AND POST_ID = :postId`;
    await executeSql(sql, { userId, postId });
  }

  async getUserBookmarks(userId: number, cursor?: number, limit = 10): Promise<PaginatedResult<Post>> {
    const sql = `
      SELECT p.POST_ID, p.USER_ID, p.CONTENT, p.IMAGE_URL, p.CREATED_AT, p.UPDATED_AT,
             u.USERNAME AS AUTHOR_USERNAME, u.DISPLAY_NAME AS AUTHOR_DISPLAY_NAME, u.PROFILE_IMAGE_URL AS AUTHOR_PROFILE_IMAGE,
             (SELECT COUNT(*) FROM LIKES WHERE POST_ID = p.POST_ID) AS LIKES_COUNT,
             (SELECT COUNT(*) FROM COMMENTS WHERE POST_ID = p.POST_ID) AS COMMENTS_COUNT,
             (SELECT COUNT(*) FROM LIKES WHERE POST_ID = p.POST_ID AND USER_ID = :userId) AS IS_LIKED,
             1 AS IS_BOOKMARKED
      FROM BOOKMARKS b
      JOIN POSTS p ON b.POST_ID = p.POST_ID
      JOIN USERS u ON p.USER_ID = u.USER_ID
      WHERE b.USER_ID = :userId
        ${cursor ? `AND p.POST_ID < :cursor` : ''}
      ORDER BY b.CREATED_AT DESC
      FETCH NEXT :fetchLimit ROWS ONLY
    `;
    const binds: Record<string, any> = { userId, fetchLimit: limit + 1 };
    if (cursor) binds.cursor = cursor;

    const res = await executeSql<RawPostRow>(sql, binds);
    const rows = res.rows || [];
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const posts = items.map((row: RawPostRow) => this.mapRowToPost(row));
    const nextCursor = hasMore && posts.length > 0 ? posts[posts.length - 1].postId : null;

    return { data: posts, nextCursor, hasMore };
  }
}
