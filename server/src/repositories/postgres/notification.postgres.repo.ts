import { executePostgresSql } from '../../db/postgres.pool.js';
import { INotificationRepository } from '../types.js';
import { Notification, PaginatedResult } from '../../types/index.js';

interface RawNotificationRow {
  notification_id: number | string;
  recipient_user_id: number | string;
  actor_user_id: number | string;
  type: string;
  post_id?: number | string | null;
  is_read: boolean | number;
  created_at: Date | string;
  actor_username: string;
  actor_display_name: string;
  actor_profile_image?: string | null;
}

export class PostgresNotificationRepository implements INotificationRepository {
  private mapRowToNotification(row: RawNotificationRow): Notification {
    return {
      notificationId: Number(row.notification_id),
      recipientUserId: Number(row.recipient_user_id),
      actorUserId: Number(row.actor_user_id),
      actor: {
        userId: Number(row.actor_user_id),
        username: row.actor_username,
        displayName: row.actor_display_name,
        profileImageUrl: row.actor_profile_image ?? undefined
      },
      type: row.type as 'LIKE' | 'COMMENT' | 'FOLLOW',
      postId: row.post_id ? Number(row.post_id) : undefined,
      isRead: typeof row.is_read === 'boolean' ? row.is_read : Boolean(Number(row.is_read) > 0),
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
    };
  }

  async createNotification(notif: {
    recipientUserId: number;
    actorUserId: number;
    type: 'LIKE' | 'COMMENT' | 'FOLLOW';
    postId?: number;
  }): Promise<Notification> {
    const sql = `
      INSERT INTO notifications (recipient_user_id, actor_user_id, type, post_id, is_read)
      VALUES ($1, $2, $3, $4, FALSE)
      RETURNING notification_id, created_at
    `;

    const res = await executePostgresSql<{
      notification_id: number | string;
      created_at: Date | string;
    }>(sql, [
      notif.recipientUserId,
      notif.actorUserId,
      notif.type,
      notif.postId || null
    ]);

    const createdRow = res.rows[0];

    const actorRes = await executePostgresSql<{
      username: string;
      display_name: string;
      profile_image_url?: string | null;
    }>(
      'SELECT username, display_name, profile_image_url FROM users WHERE user_id = $1',
      [notif.actorUserId]
    );

    const actor = actorRes.rows[0] || {
      username: `user_${notif.actorUserId}`,
      display_name: `User ${notif.actorUserId}`,
      profile_image_url: undefined
    };

    return {
      notificationId: Number(createdRow.notification_id),
      recipientUserId: notif.recipientUserId,
      actorUserId: notif.actorUserId,
      actor: {
        userId: notif.actorUserId,
        username: actor.username,
        displayName: actor.display_name,
        profileImageUrl: actor.profile_image_url ?? undefined
      },
      type: notif.type,
      postId: notif.postId,
      isRead: false,
      createdAt: new Date(createdRow.created_at).toISOString()
    };
  }

  async getUserNotifications(userId: number, cursor?: number, limit = 20): Promise<PaginatedResult<Notification>> {
    let sql = `
      SELECT n.notification_id, n.recipient_user_id, n.actor_user_id, n.type, n.post_id, n.is_read, n.created_at,
             u.username AS actor_username, u.display_name AS actor_display_name, u.profile_image_url AS actor_profile_image
      FROM notifications n
      JOIN users u ON n.actor_user_id = u.user_id
      WHERE n.recipient_user_id = $1
    `;
    const params: any[] = [userId];

    if (cursor) {
      params.push(cursor);
      sql += ` AND n.notification_id < $${params.length}`;
    }

    params.push(limit + 1);
    sql += ` ORDER BY n.notification_id DESC LIMIT $${params.length}`;

    const res = await executePostgresSql<RawNotificationRow>(sql, params);
    const rows = res.rows || [];
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const notifications = items.map((row) => this.mapRowToNotification(row));
    const nextCursor = hasMore && notifications.length > 0 ? notifications[notifications.length - 1].notificationId : null;

    return { data: notifications, nextCursor, hasMore };
  }

  async getUnreadCount(userId: number): Promise<number> {
    const sql = `SELECT COUNT(*) AS count FROM notifications WHERE recipient_user_id = $1 AND is_read = FALSE`;
    const res = await executePostgresSql<{ count: number | string }>(sql, [userId]);
    return Number(res.rows[0]?.count || 0);
  }

  async markAsRead(notificationId: number, userId: number): Promise<boolean> {
    const sql = `UPDATE notifications SET is_read = TRUE WHERE notification_id = $1 AND recipient_user_id = $2`;
    const res = await executePostgresSql(sql, [notificationId, userId]);
    return res.rowCount > 0;
  }

  async markAllAsRead(userId: number): Promise<void> {
    const sql = `UPDATE notifications SET is_read = TRUE WHERE recipient_user_id = $1 AND is_read = FALSE`;
    await executePostgresSql(sql, [userId]);
  }
}
