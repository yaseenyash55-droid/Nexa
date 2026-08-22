import { executePostgresSql } from '../../db/postgres.pool.js';
import { ICommentRepository } from '../types.js';
import { Comment, PaginatedResult } from '../../types/index.js';

interface RawCommentRow {
  comment_id: number | string;
  post_id: number | string;
  user_id: number | string;
  content: string;
  created_at: Date | string;
  updated_at: Date | string;
  author_username: string;
  author_display_name: string;
  author_profile_image?: string | null;
}

export class PostgresCommentRepository implements ICommentRepository {
  private mapRowToComment(row: RawCommentRow): Comment {
    return {
      commentId: Number(row.comment_id),
      postId: Number(row.post_id),
      userId: Number(row.user_id),
      author: {
        userId: Number(row.user_id),
        username: row.author_username,
        displayName: row.author_display_name,
        profileImageUrl: row.author_profile_image ?? undefined
      },
      content: row.content,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
    };
  }

  async createComment(comment: {
    postId: number;
    userId: number;
    content: string;
  }): Promise<Comment> {
    if (!comment.content || !comment.content.trim()) {
      throw new Error('Comment content cannot be empty');
    }

    const sql = `
      INSERT INTO comments (post_id, user_id, content)
      VALUES ($1, $2, $3)
      RETURNING comment_id, created_at, updated_at
    `;

    const res = await executePostgresSql<{
      comment_id: number | string;
      created_at: Date | string;
      updated_at: Date | string;
    }>(sql, [comment.postId, comment.userId, comment.content.trim()]);

    const createdRow = res.rows[0];

    const userRes = await executePostgresSql<{
      username: string;
      display_name: string;
      profile_image_url?: string | null;
    }>(
      'SELECT username, display_name, profile_image_url FROM users WHERE user_id = $1',
      [comment.userId]
    );

    const user = userRes.rows[0] || {
      username: `user_${comment.userId}`,
      display_name: `User ${comment.userId}`,
      profile_image_url: undefined
    };

    return {
      commentId: Number(createdRow.comment_id),
      postId: comment.postId,
      userId: comment.userId,
      author: {
        userId: comment.userId,
        username: user.username,
        displayName: user.display_name,
        profileImageUrl: user.profile_image_url ?? undefined
      },
      content: comment.content.trim(),
      createdAt: new Date(createdRow.created_at).toISOString(),
      updatedAt: new Date(createdRow.updated_at).toISOString()
    };
  }

  async getPostComments(postId: number, cursor?: number, limit = 20): Promise<PaginatedResult<Comment>> {
    let sql = `
      SELECT c.comment_id, c.post_id, c.user_id, c.content, c.created_at, c.updated_at,
             u.username AS author_username, u.display_name AS author_display_name, u.profile_image_url AS author_profile_image
      FROM comments c
      JOIN users u ON c.user_id = u.user_id
      WHERE c.post_id = $1
    `;
    const params: any[] = [postId];

    if (cursor) {
      params.push(cursor);
      sql += ` AND c.comment_id > $${params.length}`;
    }

    params.push(limit + 1);
    sql += ` ORDER BY c.comment_id ASC LIMIT $${params.length}`;

    const res = await executePostgresSql<RawCommentRow>(sql, params);
    const rows = res.rows || [];
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const comments = items.map((row) => this.mapRowToComment(row));
    const nextCursor = hasMore && comments.length > 0 ? comments[comments.length - 1].commentId : null;

    return { data: comments, nextCursor, hasMore };
  }

  async deleteComment(commentId: number, userId: number): Promise<boolean> {
    const sql = `DELETE FROM comments WHERE comment_id = $1 AND user_id = $2`;
    const res = await executePostgresSql(sql, [commentId, userId]);
    return res.rowCount > 0;
  }
}
