import oracledb from 'oracledb';
import { executeSql } from '../../db/pool.js';
import { ICommentRepository } from '../types.js';
import { Comment, PaginatedResult } from '../../types/index.js';

interface RawCommentRow {
  COMMENT_ID: number;
  POST_ID: number;
  USER_ID: number;
  CONTENT: string;
  CREATED_AT: Date;
  UPDATED_AT: Date;
  AUTHOR_USERNAME: string;
  AUTHOR_DISPLAY_NAME: string;
  AUTHOR_PROFILE_IMAGE?: string | null;
}

export class OracleCommentRepository implements ICommentRepository {
  private mapRowToComment(row: RawCommentRow): Comment {
    return {
      commentId: row.COMMENT_ID,
      postId: row.POST_ID,
      userId: row.USER_ID,
      author: {
        userId: row.USER_ID,
        username: row.AUTHOR_USERNAME,
        displayName: row.AUTHOR_DISPLAY_NAME,
        profileImageUrl: row.AUTHOR_PROFILE_IMAGE
      },
      content: row.CONTENT,
      createdAt: row.CREATED_AT ? row.CREATED_AT.toISOString() : new Date().toISOString(),
      updatedAt: row.UPDATED_AT ? row.UPDATED_AT.toISOString() : new Date().toISOString()
    };
  }

  async createComment(comment: {
    postId: number;
    userId: number;
    content: string;
  }): Promise<Comment> {
    const trimmed = comment.content.trim();
    if (!trimmed) {
      throw new Error('Comment content cannot be empty');
    }

    const sql = `
      INSERT INTO COMMENTS (POST_ID, USER_ID, CONTENT)
      VALUES (:postId, :userId, :content)
      RETURNING COMMENT_ID, CREATED_AT, UPDATED_AT INTO :commentId, :createdAt, :updatedAt
    `;

    const binds = {
      postId: comment.postId,
      userId: comment.userId,
      content: trimmed,
      commentId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
      createdAt: { type: oracledb.DATE, dir: oracledb.BIND_OUT },
      updatedAt: { type: oracledb.DATE, dir: oracledb.BIND_OUT }
    };

    const res = await executeSql<never>(sql, binds);
    const outBinds = res.outBinds as any;

    // Fetch author info to assemble complete object
    const userSql = `SELECT USERNAME, DISPLAY_NAME, PROFILE_IMAGE_URL FROM USERS WHERE USER_ID = :userId`;
    const userRes = await executeSql<{ USERNAME: string; DISPLAY_NAME: string; PROFILE_IMAGE_URL?: string }>(userSql, { userId: comment.userId });
    const authorInfo = userRes.rows ? userRes.rows[0] : { USERNAME: 'unknown', DISPLAY_NAME: 'User', PROFILE_IMAGE_URL: null };

    return {
      commentId: outBinds.commentId[0],
      postId: comment.postId,
      userId: comment.userId,
      author: {
        userId: comment.userId,
        username: authorInfo.USERNAME,
        displayName: authorInfo.DISPLAY_NAME,
        profileImageUrl: authorInfo.PROFILE_IMAGE_URL
      },
      content: trimmed,
      createdAt: outBinds.createdAt[0].toISOString(),
      updatedAt: outBinds.updatedAt[0].toISOString()
    };
  }

  async getPostComments(postId: number, cursor?: number, limit = 20): Promise<PaginatedResult<Comment>> {
    const sql = `
      SELECT c.COMMENT_ID, c.POST_ID, c.USER_ID, c.CONTENT, c.CREATED_AT, c.UPDATED_AT,
             u.USERNAME AS AUTHOR_USERNAME, u.DISPLAY_NAME AS AUTHOR_DISPLAY_NAME, u.PROFILE_IMAGE_URL AS AUTHOR_PROFILE_IMAGE
      FROM COMMENTS c
      JOIN USERS u ON c.USER_ID = u.USER_ID
      WHERE c.POST_ID = :postId
        ${cursor ? `AND c.COMMENT_ID > :cursor` : ''}
      ORDER BY c.COMMENT_ID ASC
      FETCH NEXT :fetchLimit ROWS ONLY
    `;
    const binds: Record<string, any> = { postId, fetchLimit: limit + 1 };
    if (cursor) binds.cursor = cursor;

    const res = await executeSql<RawCommentRow>(sql, binds);
    const rows = res.rows || [];
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const comments = items.map((row: RawCommentRow) => this.mapRowToComment(row));
    const nextCursor = hasMore && comments.length > 0 ? comments[comments.length - 1].commentId : null;

    return { data: comments, nextCursor, hasMore };
  }

  async deleteComment(commentId: number, userId: number): Promise<boolean> {
    const sql = `DELETE FROM COMMENTS WHERE COMMENT_ID = :commentId AND USER_ID = :userId`;
    const res = await executeSql(sql, { commentId, userId });
    return (res.rowsAffected || 0) > 0;
  }
}
