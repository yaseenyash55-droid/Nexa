import { executePostgresSql, withPostgresTransaction } from '../../db/postgres.pool.js';
import { BroadcastRepository } from '../broadcast.repository.js';
import { Broadcast } from '../../types/index.js';

export class PostgresBroadcastRepository implements BroadcastRepository {
  async createBroadcast(senderId: number, recipientIds: number[], content: string, title?: string): Promise<Broadcast> {
    return withPostgresTransaction(async (conn) => {
      const result = await conn.query(
        `INSERT INTO broadcasts (sender_id, title, content, recipients_count, created_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         RETURNING broadcast_id, created_at`,
        [
          senderId,
          title?.trim() || 'Broadcast Message',
          content.trim(),
          recipientIds.length
        ]
      );

      const broadcastId = Number(result.rows[0].broadcast_id);
      const createdAt = new Date(result.rows[0].created_at).toISOString();

      for (const rId of recipientIds) {
        await conn.query(
          `INSERT INTO broadcast_recipients (broadcast_id, recipient_user_id)
           VALUES ($1, $2)
           ON CONFLICT (broadcast_id, recipient_user_id) DO NOTHING`,
          [broadcastId, rId]
        );
      }

      return {
        broadcastId,
        senderId,
        title: title?.trim() || 'Broadcast Message',
        content: content.trim(),
        recipientsCount: recipientIds.length,
        recipientIds,
        createdAt
      };
    });
  }

  async getUserBroadcasts(senderId: number): Promise<Broadcast[]> {
    const res = await executePostgresSql(
      `SELECT broadcast_id, sender_id, title, content, recipients_count, created_at
       FROM broadcasts
       WHERE sender_id = $1
       ORDER BY created_at DESC`,
      [senderId]
    );

    return (res.rows || []).map((r: any) => ({
      broadcastId: Number(r.broadcast_id),
      senderId: Number(r.sender_id),
      title: r.title,
      content: r.content,
      recipientsCount: Number(r.recipients_count || 0),
      recipientIds: [],
      createdAt: new Date(r.created_at).toISOString()
    }));
  }
}
