import oracledb from 'oracledb';
import { executeSql, getConnection, withTransaction } from '../../db/pool.js';
import { IPrivacyRepository } from '../types.js';
import { UserPrivacySettings } from '../../types/index.js';

export class OraclePrivacyRepository implements IPrivacyRepository {
  async getPrivacySettings(userId: number): Promise<UserPrivacySettings> {
    const result = await executeSql<any>(
      `SELECT USER_ID, IS_PRIVATE, WHO_CAN_MESSAGE, WHO_CAN_COMMENT, 
              ACTIVITY_STATUS_VISIBLE, READ_RECEIPTS_ENABLED, HIDE_LIKE_COUNTS, UPDATED_AT
       FROM USER_PRIVACY_SETTINGS
       WHERE USER_ID = :userId`,
      { userId }
    );

    if (result.rows && result.rows.length > 0) {
      const row = result.rows[0];
      return {
        userId: row.USER_ID,
        isPrivate: row.IS_PRIVATE === 1,
        whoCanMessage: row.WHO_CAN_MESSAGE || 'EVERYONE',
        whoCanComment: row.WHO_CAN_COMMENT || 'EVERYONE',
        activityStatusVisible: row.ACTIVITY_STATUS_VISIBLE === 1,
        readReceiptsEnabled: row.READ_RECEIPTS_ENABLED === 1,
        hideLikeCounts: row.HIDE_LIKE_COUNTS === 1,
        updatedAt: row.UPDATED_AT ? new Date(row.UPDATED_AT).toISOString() : new Date().toISOString()
      };
    }

    // Default privacy settings if row doesn't exist yet
    return {
      userId,
      isPrivate: false,
      whoCanMessage: 'EVERYONE',
      whoCanComment: 'EVERYONE',
      activityStatusVisible: true,
      readReceiptsEnabled: true,
      hideLikeCounts: false,
      updatedAt: new Date().toISOString()
    };
  }

  async updatePrivacySettings(userId: number, updates: Partial<UserPrivacySettings>): Promise<UserPrivacySettings> {
    const current = await this.getPrivacySettings(userId);
    const isPrivate = updates.isPrivate !== undefined ? (updates.isPrivate ? 1 : 0) : (current.isPrivate ? 1 : 0);
    const whoCanMessage = updates.whoCanMessage || current.whoCanMessage;
    const whoCanComment = updates.whoCanComment || current.whoCanComment;
    const activityStatusVisible = updates.activityStatusVisible !== undefined ? (updates.activityStatusVisible ? 1 : 0) : (current.activityStatusVisible ? 1 : 0);
    const readReceiptsEnabled = updates.readReceiptsEnabled !== undefined ? (updates.readReceiptsEnabled ? 1 : 0) : (current.readReceiptsEnabled ? 1 : 0);
    const hideLikeCounts = updates.hideLikeCounts !== undefined ? (updates.hideLikeCounts ? 1 : 0) : (current.hideLikeCounts ? 1 : 0);

    await executeSql(
      `MERGE INTO USER_PRIVACY_SETTINGS target
       USING (SELECT :userId AS USER_ID FROM DUAL) source
       ON (target.USER_ID = source.USER_ID)
       WHEN MATCHED THEN
         UPDATE SET 
           IS_PRIVATE = :isPrivate,
           WHO_CAN_MESSAGE = :whoCanMessage,
           WHO_CAN_COMMENT = :whoCanComment,
           ACTIVITY_STATUS_VISIBLE = :activityStatusVisible,
           READ_RECEIPTS_ENABLED = :readReceiptsEnabled,
           HIDE_LIKE_COUNTS = :hideLikeCounts,
           UPDATED_AT = SYSTIMESTAMP
       WHEN NOT MATCHED THEN
         INSERT (USER_ID, IS_PRIVATE, WHO_CAN_MESSAGE, WHO_CAN_COMMENT, ACTIVITY_STATUS_VISIBLE, READ_RECEIPTS_ENABLED, HIDE_LIKE_COUNTS, UPDATED_AT)
         VALUES (:userId, :isPrivate, :whoCanMessage, :whoCanComment, :activityStatusVisible, :readReceiptsEnabled, :hideLikeCounts, SYSTIMESTAMP)`,
      {
        userId,
        isPrivate,
        whoCanMessage,
        whoCanComment,
        activityStatusVisible,
        readReceiptsEnabled,
        hideLikeCounts
      }
    );

    return this.getPrivacySettings(userId);
  }

  async getHiddenWords(userId: number): Promise<string[]> {
    const result = await executeSql<any>(
      `SELECT WORD FROM USER_HIDDEN_WORDS WHERE USER_ID = :userId ORDER BY CREATED_AT ASC`,
      { userId }
    );

    if (!result.rows || result.rows.length === 0) {
      return [];
    }
    return result.rows.map((r: any) => r.WORD);
  }

  async setHiddenWords(userId: number, words: string[]): Promise<string[]> {
    const uniqueWords = Array.from(new Set(words.map(w => w.trim().toLowerCase()).filter(w => w.length > 0)));

    return withTransaction(async (conn) => {
      await conn.execute(
        `DELETE FROM USER_HIDDEN_WORDS WHERE USER_ID = :userId`,
        { userId }
      );

      for (const word of uniqueWords) {
        await conn.execute(
          `INSERT INTO USER_HIDDEN_WORDS (USER_ID, WORD) VALUES (:userId, :word)`,
          { userId, word }
        );
      }

      return uniqueWords;
    });
  }

  async getBlockedUsers(userId: number): Promise<any[]> {
    const result = await executeSql<any>(
      `SELECT ub.BLOCK_ID, ub.BLOCKED_USER_ID, ub.CREATED_AT,
              u.USERNAME, u.DISPLAY_NAME, u.PROFILE_IMAGE_URL
       FROM USER_BLOCKS ub
       JOIN USERS u ON ub.BLOCKED_USER_ID = u.USER_ID
       WHERE ub.BLOCKER_USER_ID = :userId
       ORDER BY ub.CREATED_AT DESC`,
      { userId }
    );

    if (!result.rows) return [];
    return result.rows.map((r: any) => ({
      blockId: r.BLOCK_ID,
      userId: r.BLOCKED_USER_ID,
      username: r.USERNAME,
      displayName: r.DISPLAY_NAME,
      profileImageUrl: r.PROFILE_IMAGE_URL || null,
      blockedAt: r.CREATED_AT ? new Date(r.CREATED_AT).toISOString() : new Date().toISOString()
    }));
  }

  async blockUser(blockerId: number, blockedId: number): Promise<void> {
    if (blockerId === blockedId) {
      throw { statusCode: 400, code: 'SELF_BLOCK_FORBIDDEN', message: 'You cannot block yourself' };
    }

    return withTransaction(async (conn) => {
      // 1. Insert into USER_BLOCKS
      await conn.execute(
        `MERGE INTO USER_BLOCKS target
         USING (SELECT :blockerId AS BLOCKER_USER_ID, :blockedId AS BLOCKED_USER_ID FROM DUAL) source
         ON (target.BLOCKER_USER_ID = source.BLOCKER_USER_ID AND target.BLOCKED_USER_ID = source.BLOCKED_USER_ID)
         WHEN NOT MATCHED THEN
           INSERT (BLOCKER_USER_ID, BLOCKED_USER_ID, CREATED_AT)
           VALUES (:blockerId, :blockedId, SYSTIMESTAMP)`,
        { blockerId, blockedId }
      );

      // 2. Remove follow relationships mutually
      await conn.execute(
        `DELETE FROM FOLLOWERS 
         WHERE (FOLLOWER_ID = :blockerId AND FOLLOWING_ID = :blockedId)
            OR (FOLLOWER_ID = :blockedId AND FOLLOWING_ID = :blockerId)`,
        { blockerId, blockedId }
      );

      // 3. Remove any pending follow requests mutually
      await conn.execute(
        `DELETE FROM FOLLOW_REQUESTS
         WHERE (REQUESTER_USER_ID = :blockerId AND TARGET_USER_ID = :blockedId)
            OR (REQUESTER_USER_ID = :blockedId AND TARGET_USER_ID = :blockerId)`,
        { blockerId, blockedId }
      );
    });
  }

  async unblockUser(blockerId: number, blockedId: number): Promise<void> {
    await executeSql(
      `DELETE FROM USER_BLOCKS WHERE BLOCKER_USER_ID = :blockerId AND BLOCKED_USER_ID = :blockedId`,
      { blockerId, blockedId }
    );
  }

  async isBlocked(userA: number, userB: number): Promise<boolean> {
    const result = await executeSql<any>(
      `SELECT 1 FROM USER_BLOCKS 
       WHERE (BLOCKER_USER_ID = :userA AND BLOCKED_USER_ID = :userB)
          OR (BLOCKER_USER_ID = :userB AND BLOCKED_USER_ID = :userA)`,
      { userA, userB }
    );
    return (result.rows && result.rows.length > 0) || false;
  }

  async getPendingFollowRequests(targetUserId: number): Promise<any[]> {
    const result = await executeSql<any>(
      `SELECT fr.REQUEST_ID, fr.REQUESTER_USER_ID, fr.CREATED_AT,
              u.USERNAME, u.DISPLAY_NAME, u.PROFILE_IMAGE_URL
       FROM FOLLOW_REQUESTS fr
       JOIN USERS u ON fr.REQUESTER_USER_ID = u.USER_ID
       WHERE fr.TARGET_USER_ID = :targetUserId AND fr.STATUS = 'PENDING'
       ORDER BY fr.CREATED_AT DESC`,
      { targetUserId }
    );

    if (!result.rows) return [];
    return result.rows.map((r: any) => ({
      id: r.REQUEST_ID,
      requestId: r.REQUEST_ID,
      userId: r.REQUESTER_USER_ID,
      username: r.USERNAME,
      displayName: r.DISPLAY_NAME,
      profileImageUrl: r.PROFILE_IMAGE_URL || null,
      time: r.CREATED_AT ? new Date(r.CREATED_AT).toISOString() : new Date().toISOString()
    }));
  }

  async createFollowRequest(requesterId: number, targetId: number): Promise<{ requestId: number; status: string }> {
    if (requesterId === targetId) {
      throw { statusCode: 400, code: 'SELF_FOLLOW_FORBIDDEN', message: 'You cannot follow yourself' };
    }

    const conn = await getConnection();
    try {
      const result: any = await conn.execute(
        `INSERT INTO FOLLOW_REQUESTS (REQUESTER_USER_ID, TARGET_USER_ID, STATUS)
         VALUES (:requesterId, :targetId, 'PENDING')
         RETURNING REQUEST_ID INTO :outRequestId`,
        {
          requesterId,
          targetId,
          outRequestId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
        },
        { autoCommit: true }
      );

      const outId = result.outBinds?.outRequestId?.[0] || 0;
      return { requestId: outId, status: 'PENDING' };
    } finally {
      await conn.close();
    }
  }

  async respondToFollowRequest(targetUserId: number, requestId: number, accept: boolean): Promise<boolean> {
    return withTransaction(async (conn) => {
      const reqResult: any = await conn.execute(
        `SELECT REQUEST_ID, REQUESTER_USER_ID, TARGET_USER_ID, STATUS
         FROM FOLLOW_REQUESTS
         WHERE REQUEST_ID = :requestId AND TARGET_USER_ID = :targetUserId`,
        { requestId, targetUserId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (!reqResult.rows || reqResult.rows.length === 0) {
        return false;
      }

      const reqRow = reqResult.rows[0];
      const requesterId = reqRow.REQUESTER_USER_ID;

      if (accept) {
        await conn.execute(
          `MERGE INTO FOLLOWERS target
           USING (SELECT :requesterId AS FOLLOWER_ID, :targetUserId AS FOLLOWING_ID FROM DUAL) source
           ON (target.FOLLOWER_ID = source.FOLLOWER_ID AND target.FOLLOWING_ID = source.FOLLOWING_ID)
           WHEN NOT MATCHED THEN
             INSERT (FOLLOWER_ID, FOLLOWING_ID, CREATED_AT)
             VALUES (:requesterId, :targetUserId, SYSTIMESTAMP)`,
          { requesterId, targetUserId }
        );

        await conn.execute(
          `UPDATE FOLLOW_REQUESTS SET STATUS = 'ACCEPTED', UPDATED_AT = SYSTIMESTAMP WHERE REQUEST_ID = :requestId`,
          { requestId }
        );
      } else {
        await conn.execute(
          `UPDATE FOLLOW_REQUESTS SET STATUS = 'REJECTED', UPDATED_AT = SYSTIMESTAMP WHERE REQUEST_ID = :requestId`,
          { requestId }
        );
      }

      return true;
    });
  }

  async createReport(report: {
    reporterUserId: number;
    targetType: string;
    targetId: number;
    reason: string;
    details?: string;
  }): Promise<{ reportId: number; status: string }> {
    const conn = await getConnection();
    try {
      const result: any = await conn.execute(
        `INSERT INTO USER_REPORTS (REPORTER_USER_ID, TARGET_TYPE, TARGET_ID, REASON, DETAILS, STATUS)
         VALUES (:reporterUserId, :targetType, :targetId, :reason, :details, 'PENDING')
         RETURNING REPORT_ID INTO :outReportId`,
        {
          reporterUserId: report.reporterUserId,
          targetType: report.targetType.toUpperCase(),
          targetId: report.targetId,
          reason: report.reason,
          details: report.details || null,
          outReportId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
        },
        { autoCommit: true }
      );

      const reportId = result.outBinds?.outReportId?.[0] || 0;
      return { reportId, status: 'PENDING' };
    } finally {
      await conn.close();
    }
  }

  async getReports(filter?: { status?: string; targetType?: string }): Promise<any[]> {
    let query = `
      SELECT r.REPORT_ID, r.REPORTER_USER_ID, r.TARGET_TYPE, r.TARGET_ID, 
             r.REASON, r.DETAILS, r.STATUS, r.CREATED_AT, r.UPDATED_AT,
             u.USERNAME AS REPORTER_USERNAME, u.DISPLAY_NAME AS REPORTER_DISPLAY_NAME
      FROM USER_REPORTS r
      JOIN USERS u ON r.REPORTER_USER_ID = u.USER_ID
      WHERE 1=1
    `;
    const binds: any = {};

    if (filter?.status) {
      query += ` AND r.STATUS = :status`;
      binds.status = filter.status.toUpperCase();
    }
    if (filter?.targetType) {
      query += ` AND r.TARGET_TYPE = :targetType`;
      binds.targetType = filter.targetType.toUpperCase();
    }

    query += ` ORDER BY r.CREATED_AT DESC`;

    const result = await executeSql<any>(query, binds);
    if (!result.rows) return [];

    return result.rows.map((r: any) => ({
      reportId: r.REPORT_ID,
      reporterUserId: r.REPORTER_USER_ID,
      reporterUsername: r.REPORTER_USERNAME,
      reporterDisplayName: r.REPORTER_DISPLAY_NAME,
      targetType: r.TARGET_TYPE,
      targetId: r.TARGET_ID,
      reason: r.REASON,
      details: r.DETAILS || '',
      status: r.STATUS,
      createdAt: r.CREATED_AT ? new Date(r.CREATED_AT).toISOString() : new Date().toISOString(),
      updatedAt: r.UPDATED_AT ? new Date(r.UPDATED_AT).toISOString() : new Date().toISOString()
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
    return withTransaction(async (conn) => {
      const result: any = await conn.execute(
        `INSERT INTO MODERATION_ACTIONS (REPORT_ID, MODERATOR_USER_ID, ACTION_TYPE, TARGET_TYPE, TARGET_ID, NOTES)
         VALUES (:reportId, :moderatorUserId, :actionType, :targetType, :targetId, :notes)
         RETURNING ACTION_ID INTO :outActionId`,
        {
          reportId: action.reportId || null,
          moderatorUserId: action.moderatorUserId,
          actionType: action.actionType.toUpperCase(),
          targetType: action.targetType.toUpperCase(),
          targetId: action.targetId,
          notes: action.notes || null,
          outActionId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }
        }
      );

      if (action.reportId) {
        await conn.execute(
          `UPDATE USER_REPORTS SET STATUS = 'RESOLVED', UPDATED_AT = SYSTIMESTAMP WHERE REPORT_ID = :reportId`,
          { reportId: action.reportId }
        );
      }

      const actionId = result.outBinds?.outActionId?.[0] || 0;
      return { actionId };
    });
  }
}

export const oraclePrivacyRepo = new OraclePrivacyRepository();
