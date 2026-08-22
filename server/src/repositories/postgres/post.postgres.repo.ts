import { executePostgresSql } from '../../db/postgres.pool.js';
import { IPostRepository } from '../types.js';
import { Post, PaginatedResult } from '../../types/index.js';

interface RawPostRow {
  post_id: number | string;
  user_id: number | string;
  content?: string | null;
  image_url?: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  author_username: string;
  author_display_name: string;
  author_profile_image?: string | null;
  likes_count: number | string;
  comments_count: number | string;
  is_liked?: number | boolean;
  is_bookmarked?: number | boolean;
}

export class PostgresPostRepository implements IPostRepository {
  private mapRowToPost(row: RawPostRow): Post {
    return {
      postId: Number(row.post_id),
      userId: Number(row.user_id),
      author: {
        userId: Number(row.user_id),
        username: row.author_username,
        displayName: row.author_display_name,
        profileImageUrl: row.author_profile_image ?? undefined
      },
      content: row.content ?? undefined,
      imageUrl: row.image_url ?? undefined,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
      likesCount: Number(row.likes_count || 0),
      commentsCount: Number(row.comments_count || 0),
      isLiked: Boolean(row.is_liked && Number(row.is_liked) > 0),
      isBookmarked: Boolean(row.is_bookmarked && Number(row.is_bookmarked) > 0)
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

    let safeImageUrl: string | null = post.imageUrl?.trim() || null;
    if (safeImageUrl && safeImageUrl.length > 2000 && !safeImageUrl.startsWith('http') && !safeImageUrl.startsWith('/')) {
      safeImageUrl = safeImageUrl.substring(0, 2000);
    }

    const sql = `
      INSERT INTO posts (user_id, content, image_url)
      VALUES ($1, $2, $3)
      RETURNING post_id
    `;

    const res = await executePostgresSql<{ post_id: number | string }>(sql, [
      post.userId,
      post.content?.trim() || null,
      safeImageUrl
    ]);

    const newPostId = Number(res.rows[0].post_id);
    const created = await this.findById(newPostId, post.userId);
    if (!created) throw new Error('Failed to retrieve newly created post');
    return created;
  }

  async findById(postId: number, currentUserId?: number): Promise<Post | null> {
    const sql = `
      SELECT p.post_id, p.user_id, p.content, p.image_url, p.created_at, p.updated_at,
             u.username AS author_username, u.display_name AS author_display_name, u.profile_image_url AS author_profile_image,
             (SELECT COUNT(*) FROM likes WHERE post_id = p.post_id) AS likes_count,
             (SELECT COUNT(*) FROM comments WHERE post_id = p.post_id) AS comments_count,
             ${currentUserId ? `(SELECT COUNT(*) FROM likes WHERE post_id = p.post_id AND user_id = $2)` : '0'} AS is_liked,
             ${currentUserId ? `(SELECT COUNT(*) FROM bookmarks WHERE post_id = p.post_id AND user_id = $2)` : '0'} AS is_bookmarked
      FROM posts p
      JOIN users u ON p.user_id = u.user_id
      WHERE p.post_id = $1
    `;
    const params: any[] = [postId];
    if (currentUserId) params.push(currentUserId);

    const res = await executePostgresSql<RawPostRow>(sql, params);
    if (!res.rows || res.rows.length === 0) return null;
    return this.mapRowToPost(res.rows[0]);
  }

  async updatePost(postId: number, data: { content?: string }): Promise<Post> {
    const sql = `UPDATE posts SET content = $1, updated_at = CURRENT_TIMESTAMP WHERE post_id = $2`;
    await executePostgresSql(sql, [data.content || null, postId]);
    const updated = await this.findById(postId);
    if (!updated) throw new Error('Post not found after update');
    return updated;
  }

  async deletePost(postId: number, userId: number): Promise<boolean> {
    const sql = `DELETE FROM posts WHERE post_id = $1 AND user_id = $2`;
    const res = await executePostgresSql(sql, [postId, userId]);
    return res.rowCount > 0;
  }

  async getGlobalFeed(currentUserId?: number, cursor?: number, limit = 10): Promise<PaginatedResult<Post>> {
    let sql = `
      SELECT p.post_id, p.user_id, p.content, p.image_url, p.created_at, p.updated_at,
             u.username AS author_username, u.display_name AS author_display_name, u.profile_image_url AS author_profile_image,
             (SELECT COUNT(*) FROM likes WHERE post_id = p.post_id) AS likes_count,
             (SELECT COUNT(*) FROM comments WHERE post_id = p.post_id) AS comments_count,
             ${currentUserId ? `(SELECT COUNT(*) FROM likes WHERE post_id = p.post_id AND user_id = $1)` : '0'} AS is_liked,
             ${currentUserId ? `(SELECT COUNT(*) FROM bookmarks WHERE post_id = p.post_id AND user_id = $1)` : '0'} AS is_bookmarked
      FROM posts p
      JOIN users u ON p.user_id = u.user_id
    `;
    const params: any[] = [];
    if (currentUserId) params.push(currentUserId);

    if (cursor) {
      params.push(cursor);
      sql += ` WHERE p.post_id < $${params.length}`;
    }

    params.push(limit + 1);
    sql += ` ORDER BY p.post_id DESC LIMIT $${params.length}`;

    const res = await executePostgresSql<RawPostRow>(sql, params);
    const rows = res.rows || [];
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const posts = items.map((row) => this.mapRowToPost(row));
    const nextCursor = hasMore && posts.length > 0 ? posts[posts.length - 1].postId : null;

    return { data: posts, nextCursor, hasMore };
  }

  async getFollowingFeed(userId: number, cursor?: number, limit = 10): Promise<PaginatedResult<Post>> {
    let sql = `
      SELECT p.post_id, p.user_id, p.content, p.image_url, p.created_at, p.updated_at,
             u.username AS author_username, u.display_name AS author_display_name, u.profile_image_url AS author_profile_image,
             (SELECT COUNT(*) FROM likes WHERE post_id = p.post_id) AS likes_count,
             (SELECT COUNT(*) FROM comments WHERE post_id = p.post_id) AS comments_count,
             (SELECT COUNT(*) FROM likes WHERE post_id = p.post_id AND user_id = $1) AS is_liked,
             (SELECT COUNT(*) FROM bookmarks WHERE post_id = p.post_id AND user_id = $1) AS is_bookmarked
      FROM posts p
      JOIN users u ON p.user_id = u.user_id
      WHERE (p.user_id = $1 OR p.user_id IN (SELECT following_id FROM followers WHERE follower_id = $1))
    `;
    const params: any[] = [userId];

    if (cursor) {
      params.push(cursor);
      sql += ` AND p.post_id < $${params.length}`;
    }

    params.push(limit + 1);
    sql += ` ORDER BY p.post_id DESC LIMIT $${params.length}`;

    const res = await executePostgresSql<RawPostRow>(sql, params);
    const rows = res.rows || [];
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const posts = items.map((row) => this.mapRowToPost(row));
    const nextCursor = hasMore && posts.length > 0 ? posts[posts.length - 1].postId : null;

    return { data: posts, nextCursor, hasMore };
  }

  async getUserPosts(userId: number, currentUserId?: number, cursor?: number, limit = 10): Promise<PaginatedResult<Post>> {
    let sql = `
      SELECT p.post_id, p.user_id, p.content, p.image_url, p.created_at, p.updated_at,
             u.username AS author_username, u.display_name AS author_display_name, u.profile_image_url AS author_profile_image,
             (SELECT COUNT(*) FROM likes WHERE post_id = p.post_id) AS likes_count,
             (SELECT COUNT(*) FROM comments WHERE post_id = p.post_id) AS comments_count,
             ${currentUserId ? `(SELECT COUNT(*) FROM likes WHERE post_id = p.post_id AND user_id = $2)` : '0'} AS is_liked,
             ${currentUserId ? `(SELECT COUNT(*) FROM bookmarks WHERE post_id = p.post_id AND user_id = $2)` : '0'} AS is_bookmarked
      FROM posts p
      JOIN users u ON p.user_id = u.user_id
      WHERE p.user_id = $1
    `;
    const params: any[] = [userId];
    if (currentUserId) params.push(currentUserId);

    if (cursor) {
      params.push(cursor);
      sql += ` AND p.post_id < $${params.length}`;
    }

    params.push(limit + 1);
    sql += ` ORDER BY p.post_id DESC LIMIT $${params.length}`;

    const res = await executePostgresSql<RawPostRow>(sql, params);
    const rows = res.rows || [];
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const posts = items.map((row) => this.mapRowToPost(row));
    const nextCursor = hasMore && posts.length > 0 ? posts[posts.length - 1].postId : null;

    return { data: posts, nextCursor, hasMore };
  }

  async likePost(userId: number, postId: number): Promise<void> {
    const sql = `
      INSERT INTO likes (post_id, user_id, created_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (post_id, user_id) DO NOTHING
    `;
    await executePostgresSql(sql, [postId, userId]);
  }

  async unlikePost(userId: number, postId: number): Promise<void> {
    const sql = `DELETE FROM likes WHERE post_id = $1 AND user_id = $2`;
    await executePostgresSql(sql, [postId, userId]);
  }

  async bookmarkPost(userId: number, postId: number): Promise<void> {
    const sql = `
      INSERT INTO bookmarks (user_id, post_id, created_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, post_id) DO NOTHING
    `;
    await executePostgresSql(sql, [userId, postId]);
  }

  async unbookmarkPost(userId: number, postId: number): Promise<void> {
    const sql = `DELETE FROM bookmarks WHERE user_id = $1 AND post_id = $2`;
    await executePostgresSql(sql, [userId, postId]);
  }

  async getUserBookmarks(userId: number, cursor?: number, limit = 10): Promise<PaginatedResult<Post>> {
    let sql = `
      SELECT p.post_id, p.user_id, p.content, p.image_url, p.created_at, p.updated_at,
             u.username AS author_username, u.display_name AS author_display_name, u.profile_image_url AS author_profile_image,
             (SELECT COUNT(*) FROM likes WHERE post_id = p.post_id) AS likes_count,
             (SELECT COUNT(*) FROM comments WHERE post_id = p.post_id) AS comments_count,
             (SELECT COUNT(*) FROM likes WHERE post_id = p.post_id AND user_id = $1) AS is_liked,
             1 AS is_bookmarked
      FROM bookmarks b
      JOIN posts p ON b.post_id = p.post_id
      JOIN users u ON p.user_id = u.user_id
      WHERE b.user_id = $1
    `;
    const params: any[] = [userId];

    if (cursor) {
      params.push(cursor);
      sql += ` AND p.post_id < $${params.length}`;
    }

    params.push(limit + 1);
    sql += ` ORDER BY b.created_at DESC LIMIT $${params.length}`;

    const res = await executePostgresSql<RawPostRow>(sql, params);
    const rows = res.rows || [];
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const posts = items.map((row) => this.mapRowToPost(row));
    const nextCursor = hasMore && posts.length > 0 ? posts[posts.length - 1].postId : null;

    return { data: posts, nextCursor, hasMore };
  }
}
