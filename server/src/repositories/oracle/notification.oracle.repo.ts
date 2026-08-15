import oracledb from 'oracledb';
import { executeSql } from '../../db/pool.js';
import { INotificationRepository } from '../types.js';
import { Notification, PaginatedResult } from '../../types/index.js';

interface RawNotifRow {
  NOTIFICATION_ID: number;
  RECIPIENT_USER_ID: number;
  ACTOR_USER_ID: number;
  TYPE: 'LIKE' | 'COMMENT' | 'FOLLOW';
  POST_ID?: number | null;
  IS_READ: number;
  CREATED_AT: Date;
  ACTOR_USERNAME: string;
  ACTOR_DISPLAY_NAME: string;
  ACTOR_PROFILE_IMAGE?: string | null;
}

export class OracleNotificationRepository implements INotificationRepository {
  private mapRowToNotification(row: RawNotifRow): Notification {
    return {
      notificationId: row.NOTIFICATION_ID,
      recipientUserId: row.RECIPIENT_USER_ID,
      actorUserId: row.ACTOR_USER_ID,
      actor: {
        userId: row.ACTOR_USER_ID,
        username: row.ACTOR_USERNAME,
        displayName: row.ACTOR_DISPLAY_NAME,
        profileImageUrl: row.ACTOR_PROFILE_IMAGE
      },
      type: row.TYPE,
      postId: row.POST_ID,
      isRead: Boolean(row.IS_READ === 1),
      createdAt: row.CREATED_AT ? row.CREATED_AT.toISOString() : new Date().toISOString()
    };
  }

  async createNotification(notif: {
    recipientUserId: number;
    actorUserId: number;
    type: 'LIKE' | 'COMMENT' | 'FOLLOW';
    postId?: number;
  }): Promise<Notification> {
    // Prevent self-notification
    if (notif.recipientUserId === notif.actorUserId) {
      throw new Error('Self-notifications are ignored');
    }

    const sql = `
      INSERT INTO NOTIFICATIONS (RECIPIENT_USER_ID, ACTOR_USER_ID, TYPE, POST_ID, IS_READ)
      VALUES (:recipientUserId, :actorUserId, :type, :postId, 0)
      RETURNING NOTIFICATION_ID, CREATED_AT INTO :notificationId, :createdAt
    `;

    const binds = {
      recipientUserId: notif.recipientUserId,
      actorUserId: notif.actorUserId,
      type: notif.type,
      postId: notif.postId || null,
      notificationId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
      createdAt: { type: oracledb.DATE, dir: oracledb.BIND_OUT }
    };

    const res = await executeSql<never>(sql, binds);
    const outBinds = res.outBinds as any;

    const actorSql = `SELECT USERNAME, DISPLAY_NAME, PROFILE_IMAGE_URL FROM USERS WHERE USER_ID = :actorUserId`;
    const actorRes = await executeSql<{ USERNAME: string; DISPLAY_NAME: string; PROFILE_IMAGE_URL?: string }>(actorSql, { actorUserId: notif.actorUserId });
    const actorInfo = actorRes.rows ? actorRes.rows[0] : { USERNAME: 'unknown', DISPLAY_NAME: 'User', PROFILE_IMAGE_URL: null };

    return {
      notificationId: outBinds.notificationId[0],
      recipientUserId: notif.recipientUserId,
      actorUserId: notif.actorUserId,
      actor: {
        userId: notif.actorUserId,
        username: actorInfo.USERNAME,
        displayName: actorInfo.DISPLAY_NAME,
        profileImageUrl: actorInfo.PROFILE_IMAGE_URL
      },
      type: notif.type,
      postId: notif.postId || null,
      isRead: false,
      createdAt: outBinds.createdAt[0].toISOString()
    };
  }

  async getUserNotifications(userId: number, cursor?: number, limit = 20): Promise<PaginatedResult<Notification>> {
    const sql = `
      SELECT n.NOTIFICATION_ID, n.RECIPIENT_USER_ID, n.ACTOR_USER_ID, n.TYPE, n.POST_ID, n.IS_READ, n.CREATED_AT,
             u.USERNAME AS ACTOR_USERNAME, u.DISPLAY_NAME AS ACTOR_DISPLAY_NAME, u.PROFILE_IMAGE_URL AS ACTOR_PROFILE_IMAGE
      FROM NOTIFICATIONS n
      JOIN USERS u ON n.ACTOR_USER_ID = u.USER_ID
      WHERE n.RECIPIENT_USER_ID = :userId
        ${cursor ? `AND n.NOTIFICATION_ID < :cursor` : ''}
      ORDER BY n.NOTIFICATION_ID DESC
      FETCH NEXT :fetchLimit ROWS ONLY
    `;
    const binds: Record<string, any> = { userId, fetchLimit: limit + 1 };
    if (cursor) binds.cursor = cursor;

    const res = await executeSql<RawNotifRow>(sql, binds);
    const rows = res.rows || [];
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const notifications = items.map((row: RawNotifRow) => this.mapRowToNotification(row));
    const nextCursor = hasMore && notifications.length > 0 ? notifications[notifications.length - 1].notificationId : null;

    return { data: notifications, nextCursor, hasMore };
  }

  async getUnreadCount(userId: number): Promise<number> {
    const sql = `SELECT COUNT(*) AS UNREAD_COUNT FROM NOTIFICATIONS WHERE RECIPIENT_USER_ID = :userId AND IS_READ = 0`;
    const res = await executeSql<{ UNREAD_COUNT: number }>(sql, { userId });
    return res.rows && res.rows.length > 0 ? res.rows[0].UNREAD_COUNT : 0;
  }

  async markAsRead(notificationId: number, userId: number): Promise<boolean> {
    const sql = `
      UPDATE NOTIFICATIONS SET IS_READ = 1 WHERE NOTIFICATION_ID = :notificationId AND RECIPIENT_USER_ID = :userId
    `;
    const res = await executeSql(sql, { notificationId, userId });
    return (res.rowsAffected || 0) > 0;
  }

  async markAllAsRead(userId: number): Promise<void> {
    const sql = `
      UPDATE NOTIFICATIONS SET IS_READ = 1 WHERE RECIPIENT_USER_ID = :userId AND IS_READ = 0
    `;
    await executeSql(sql, { userId });
  }
}
