import { executePostgresSql } from '../../db/postgres.pool.js';
import { IPrivacyRepository } from '../types.js';

export class PostgresPrivacyRepository implements IPrivacyRepository {
  async getPrivacySettings(userId: number): Promise<any> {
    const sql = `
      SELECT user_id, is_private, who_can_message, who_can_comment,
             activity_status_visible, read_receipts_enabled, hide_like_counts
      FROM user_privacy_settings
      WHERE user_id = $1
    `;
    const res = await executePostgresSql(sql, [userId]);
    if (res.rows.length === 0) {
      return {
        userId,
        isPrivate: false,
        whoCanMessage: 'EVERYONE',
        whoCanComment: 'EVERYONE',
        activityStatusVisible: true,
        readReceiptsEnabled: true,
        hideLikeCounts: false
      };
    }
    const r = res.rows[0];
    return {
      userId: Number(r.user_id),
      isPrivate: typeof r.is_private === 'boolean' ? r.is_private : Boolean(Number(r.is_private) > 0),
      whoCanMessage: r.who_can_message,
      whoCanComment: r.who_can_comment,
      activityStatusVisible: typeof r.activity_status_visible === 'boolean' ? r.activity_status_visible : Boolean(Number(r.activity_status_visible) > 0),
      readReceiptsEnabled: typeof r.read_receipts_enabled === 'boolean' ? r.read_receipts_enabled : Boolean(Number(r.read_receipts_enabled) > 0),
      hideLikeCounts: typeof r.hide_like_counts === 'boolean' ? r.hide_like_counts : Boolean(Number(r.hide_like_counts) > 0)
    };
  }

  async updatePrivacySettings(userId: number, updates: any): Promise<any> {
    const current = await this.getPrivacySettings(userId);
    const updated = { ...current, ...updates };

    const sql = `
      INSERT INTO user_privacy_settings (
        user_id, is_private, who_can_message, who_can_comment,
        activity_status_visible, read_receipts_enabled, hide_like_counts, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) DO UPDATE SET
        is_private = EXCLUDED.is_private,
        who_can_message = EXCLUDED.who_can_message,
        who_can_comment = EXCLUDED.who_can_comment,
        activity_status_visible = EXCLUDED.activity_status_visible,
        read_receipts_enabled = EXCLUDED.read_receipts_enabled,
        hide_like_counts = EXCLUDED.hide_like_counts,
        updated_at = CURRENT_TIMESTAMP
    `;
    await executePostgresSql(sql, [
      userId,
      updated.isPrivate,
      updated.whoCanMessage,
      updated.whoCanComment,
      updated.activityStatusVisible,
      updated.readReceiptsEnabled,
      updated.hideLikeCounts
    ]);

    return updated;
  }

  async getHiddenWords(userId: number): Promise<string[]> {
    const sql = `SELECT word FROM user_hidden_words WHERE user_id = $1 ORDER BY created_at ASC`;
    const res = await executePostgresSql<{ word: string }>(sql, [userId]);
    return (res.rows || []).map((r) => r.word);
  }

  async setHiddenWords(userId: number, words: string[]): Promise<string[]> {
    await executePostgresSql(`DELETE FROM user_hidden_words WHERE user_id = $1`, [userId]);
    const cleanWords = Array.from(new Set(words.map((w) => w.trim().toLowerCase()).filter(Boolean)));

    for (const w of cleanWords) {
      await executePostgresSql(
        `INSERT INTO user_hidden_words (user_id, word) VALUES ($1, $2) ON CONFLICT (user_id, word) DO NOTHING`,
        [userId, w]
      );
    }
    return cleanWords;
  }

  async getBlockedUsers(userId: number): Promise<any[]> {
    const sql = `
      SELECT b.block_id, b.blocked_user_id, b.created_at,
             u.username, u.display_name, u.profile_image_url
      FROM user_blocks b
      JOIN users u ON b.blocked_user_id = u.user_id
      WHERE b.blocker_user_id = $1
      ORDER BY b.created_at DESC
    `;
    const res = await executePostgresSql(sql, [userId]);
    return (res.rows || []).map((r: any) => ({
      blockId: Number(r.block_id),
      blockedUserId: Number(r.blocked_user_id),
      user: {
        userId: Number(r.blocked_user_id),
        username: r.username,
        displayName: r.display_name,
        profileImageUrl: r.profile_image_url ?? undefined
      },
      createdAt: new Date(r.created_at).toISOString()
    }));
  }

  async blockUser(blockerId: number, blockedId: number): Promise<void> {
    if (blockerId === blockedId) throw new Error('Cannot block yourself');
    const sql = `
      INSERT INTO user_blocks (blocker_user_id, blocked_user_id)
      VALUES ($1, $2)
      ON CONFLICT (blocker_user_id, blocked_user_id) DO NOTHING
    `;
    await executePostgresSql(sql, [blockerId, blockedId]);
    // Mutual unfollow
    await executePostgresSql(
      `DELETE FROM followers WHERE (follower_id = $1 AND following_id = $2) OR (follower_id = $2 AND following_id = $1)`,
      [blockerId, blockedId]
    );
  }

  async unblockUser(blockerId: number, blockedId: number): Promise<void> {
    const sql = `DELETE FROM user_blocks WHERE blocker_user_id = $1 AND blocked_user_id = $2`;
    await executePostgresSql(sql, [blockerId, blockedId]);
  }

  async isBlocked(userA: number, userB: number): Promise<boolean> {
    const sql = `
      SELECT COUNT(*) AS count FROM user_blocks
      WHERE (blocker_user_id = $1 AND blocked_user_id = $2)
         OR (blocker_user_id = $2 AND blocked_user_id = $1)
    `;
    const res = await executePostgresSql<{ count: number | string }>(sql, [userA, userB]);
    return Number(res.rows[0]?.count || 0) > 0;
  }

  async getPendingFollowRequests(targetUserId: number): Promise<any[]> {
    const sql = `
      SELECT fr.request_id, fr.requester_user_id, fr.created_at,
             u.username, u.display_name, u.profile_image_url
      FROM follow_requests fr
      JOIN users u ON fr.requester_user_id = u.user_id
      WHERE fr.target_user_id = $1 AND fr.status = 'PENDING'
      ORDER BY fr.created_at DESC
    `;
    const res = await executePostgresSql(sql, [targetUserId]);
    return (res.rows || []).map((r: any) => ({
      requestId: Number(r.request_id),
      requesterUserId: Number(r.requester_user_id),
      requester: {
        userId: Number(r.requester_user_id),
        username: r.username,
        displayName: r.display_name,
        profileImageUrl: r.profile_image_url ?? undefined
      },
      createdAt: new Date(r.created_at).toISOString()
    }));
  }

  async createFollowRequest(requesterId: number, targetId: number): Promise<{ requestId: number; status: string }> {
    const sql = `
      INSERT INTO follow_requests (requester_user_id, target_user_id, status)
      VALUES ($1, $2, 'PENDING')
      ON CONFLICT (requester_user_id, target_user_id) DO UPDATE SET
        status = 'PENDING',
        updated_at = CURRENT_TIMESTAMP
      RETURNING request_id, status
    `;
    const res = await executePostgresSql<{ request_id: number | string; status: string }>(sql, [
      requesterId,
      targetId
    ]);
    return {
      requestId: Number(res.rows[0].request_id),
      status: res.rows[0].status
    };
  }

  async respondToFollowRequest(targetUserId: number, requestId: number, accept: boolean): Promise<boolean> {
    const checkSql = `SELECT requester_user_id, target_user_id, status FROM follow_requests WHERE request_id = $1 AND target_user_id = $2`;
    const res = await executePostgresSql<{ requester_user_id: number | string; target_user_id: number | string; status: string }>(checkSql, [
      requestId,
      targetUserId
    ]);
    if (res.rows.length === 0) return false;

    const row = res.rows[0];
    const requesterId = Number(row.requester_user_id);

    if (accept) {
      await executePostgresSql(
        `INSERT INTO followers (follower_id, following_id) VALUES ($1, $2) ON CONFLICT (follower_id, following_id) DO NOTHING`,
        [requesterId, targetUserId]
      );
      await executePostgresSql(
        `UPDATE follow_requests SET status = 'ACCEPTED', updated_at = CURRENT_TIMESTAMP WHERE request_id = $1`,
        [requestId]
      );
    } else {
      await executePostgresSql(
        `UPDATE follow_requests SET status = 'REJECTED', updated_at = CURRENT_TIMESTAMP WHERE request_id = $1`,
        [requestId]
      );
    }
    return true;
  }

  async createReport(report: {
    reporterUserId: number;
    targetType: string;
    targetId: number;
    reason: string;
    details?: string;
  }): Promise<{ reportId: number; status: string }> {
    const sql = `
      INSERT INTO user_reports (reporter_user_id, target_type, target_id, reason, details, status)
      VALUES ($1, $2, $3, $4, $5, 'PENDING')
      RETURNING report_id, status
    `;
    const res = await executePostgresSql<{ report_id: number | string; status: string }>(sql, [
      report.reporterUserId,
      report.targetType,
      report.targetId,
      report.reason,
      report.details || null
    ]);
    return {
      reportId: Number(res.rows[0].report_id),
      status: res.rows[0].status
    };
  }

  async getReports(filter?: { status?: string; targetType?: string }): Promise<any[]> {
    let sql = `
      SELECT r.report_id, r.reporter_user_id, r.target_type, r.target_id, r.reason, r.details, r.status, r.created_at,
             u.username AS reporter_username
      FROM user_reports r
      JOIN users u ON r.reporter_user_id = u.user_id
    `;
    const conditions: string[] = [];
    const params: any[] = [];

    if (filter?.status) {
      params.push(filter.status);
      conditions.push(`r.status = $${params.length}`);
    }
    if (filter?.targetType) {
      params.push(filter.targetType);
      conditions.push(`r.target_type = $${params.length}`);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ` + conditions.join(' AND ');
    }
    sql += ` ORDER BY r.created_at DESC`;

    const res = await executePostgresSql(sql, params);
    return (res.rows || []).map((r: any) => ({
      reportId: Number(r.report_id),
      reporterUserId: Number(r.reporter_user_id),
      reporterUsername: r.reporter_username,
      targetType: r.target_type,
      targetId: Number(r.target_id),
      reason: r.reason,
      details: r.details,
      status: r.status,
      createdAt: new Date(r.created_at).toISOString()
    }));
  }

  async createModerationAction(action: {
    reportId?: number;
    moderatorUserId: number;
    actionType: string;
    targetType: string;
    targetId: number;
    notes?: string;
  }): Promise<{ actionId: number }> {
    const sql = `
      INSERT INTO moderation_actions (report_id, moderator_user_id, action_type, target_type, target_id, notes)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING action_id
    `;
    const res = await executePostgresSql<{ action_id: number | string }>(sql, [
      action.reportId || null,
      action.moderatorUserId,
      action.actionType,
      action.targetType,
      action.targetId,
      action.notes || null
    ]);

    if (action.reportId) {
      await executePostgresSql(
        `UPDATE user_reports SET status = 'RESOLVED', updated_at = CURRENT_TIMESTAMP WHERE report_id = $1`,
        [action.reportId]
      );
    }

    return { actionId: Number(res.rows[0].action_id) };
  }
}

export const postgresPrivacyRepo = new PostgresPrivacyRepository();
