import { executePostgresSql } from '../../db/postgres.pool.js';
import { IMessageRepository } from '../types.js';
import { ConversationSummary, Message } from '../../types/index.js';

interface RawMessageRow {
  message_id: number | string;
  sender_id?: number | string | null;
  receiver_id: number | string;
  content: string;
  read_at?: Date | string | null;
  is_unsent: boolean;
  created_at: Date | string;
  sender_username?: string | null;
  sender_display_name?: string | null;
  sender_profile_image?: string | null;
  sender_type?: string | null;
  ai_agent?: string | null;
  trigger_message_id?: number | string | null;
}

export class PostgresMessageRepository implements IMessageRepository {
  private mapRowToMessage(row: RawMessageRow): Message {
    const isUnsent = Boolean(row.is_unsent);
    const isAi = (row.sender_type || '').toLowerCase() === 'ai' || row.sender_id === null;

    return {
      messageId: Number(row.message_id),
      senderId: isAi ? null : Number(row.sender_id),
      receiverId: Number(row.receiver_id),
      senderType: isAi ? 'ai' : 'user',
      aiAgent: isAi ? (row.ai_agent || 'nexa') : undefined,
      triggerMessageId: row.trigger_message_id ? Number(row.trigger_message_id) : null,
      sender: {
        userId: isAi ? 0 : Number(row.sender_id),
        username: isAi ? 'nexa' : (row.sender_username || 'user'),
        displayName: isAi ? 'NEXA AI' : (row.sender_display_name || 'User'),
        profileImageUrl: isAi ? '/nexa-ai-avatar.png' : (row.sender_profile_image ?? undefined)
      },
      content: isUnsent ? 'Message unsent' : row.content,
      isRead: Boolean(row.read_at),
      isUnsent,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
    };
  }

  async findAiResponseByTrigger(triggerKey: string | number, aiAgent = 'nexa'): Promise<Message | null> {
    let triggerId: number | null = null;
    if (typeof triggerKey === 'number') {
      triggerId = triggerKey;
    } else {
      const parts = triggerKey.split(':');
      const last = parts[parts.length - 1];
      const parsed = parseInt(last, 10);
      if (!isNaN(parsed)) {
        triggerId = parsed;
      }
    }

    if (!triggerId) return null;

    const sql = `
      SELECT m.message_id, m.sender_id, m.receiver_id, m.content, m.read_at, m.is_unsent, m.created_at,
             m.sender_type, m.ai_agent, m.trigger_message_id,
             u.username AS sender_username, u.display_name AS sender_display_name, u.profile_image_url AS sender_profile_image
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.user_id
      WHERE m.trigger_message_id = $1
        AND m.sender_type = 'ai'
        AND m.ai_agent = $2
      LIMIT 1
    `;
    const res = await executePostgresSql<RawMessageRow>(sql, [triggerId, aiAgent]);
    const row = res.rows?.[0];
    return row ? this.mapRowToMessage(row) : null;
  }

  async sendAiMessage(msg: { receiverId: number; content: string; aiAgent?: string; triggerMessageId?: number | null }): Promise<Message> {
    const agentName = msg.aiAgent || 'nexa';

    if (msg.triggerMessageId) {
      const existing = await this.findAiResponseByTrigger(msg.triggerMessageId, agentName);
      if (existing) return existing;
    }

    const sql = `
      INSERT INTO messages (sender_id, receiver_id, content, sender_type, ai_agent, trigger_message_id)
      VALUES (NULL, $1, $2, 'ai', $3, $4)
      ON CONFLICT (trigger_message_id, ai_agent) WHERE trigger_message_id IS NOT NULL AND sender_type = 'ai'
      DO UPDATE SET content = messages.content
      RETURNING message_id, created_at, trigger_message_id
    `;
    const res = await executePostgresSql<{
      message_id: number | string;
      created_at: Date | string;
      trigger_message_id?: number | string | null;
    }>(sql, [msg.receiverId, msg.content.trim(), agentName, msg.triggerMessageId ?? null]);

    const row = res.rows[0];
    return {
      messageId: Number(row.message_id),
      senderId: null,
      receiverId: msg.receiverId,
      senderType: 'ai',
      aiAgent: agentName,
      triggerMessageId: msg.triggerMessageId ?? null,
      sender: {
        userId: 0,
        username: 'nexa',
        displayName: 'NEXA AI',
        profileImageUrl: '/nexa-ai-avatar.png'
      },
      content: msg.content.trim(),
      isRead: false,
      createdAt: new Date(row.created_at).toISOString()
    };
  }

  async sendMessage(msg: { senderId: number; receiverId: number; content: string }): Promise<Message> {
    if (!msg.content || !msg.content.trim()) {
      throw new Error('Message content cannot be empty');
    }

    const sql = `
      INSERT INTO messages (sender_id, receiver_id, content)
      VALUES ($1, $2, $3)
      RETURNING message_id, created_at
    `;

    const res = await executePostgresSql<{
      message_id: number | string;
      created_at: Date | string;
    }>(sql, [msg.senderId, msg.receiverId, msg.content.trim()]);

    const createdRow = res.rows[0];

    const senderRes = await executePostgresSql<{
      username: string;
      display_name: string;
      profile_image_url?: string | null;
    }>(
      'SELECT username, display_name, profile_image_url FROM users WHERE user_id = $1',
      [msg.senderId]
    );

    const sender = senderRes.rows[0] || {
      username: `user_${msg.senderId}`,
      display_name: `User ${msg.senderId}`,
      profile_image_url: undefined
    };

    return {
      messageId: Number(createdRow.message_id),
      senderId: msg.senderId,
      receiverId: msg.receiverId,
      sender: {
        userId: msg.senderId,
        username: sender.username,
        displayName: sender.display_name,
        profileImageUrl: sender.profile_image_url ?? undefined
      },
      content: msg.content.trim(),
      isRead: false,
      createdAt: new Date(createdRow.created_at).toISOString()
    };
  }

  async getMessagesBetweenUsers(userA: number, userB: number): Promise<Message[]> {
    const sql = `
      SELECT m.message_id, m.sender_id, m.receiver_id, m.content, m.read_at, m.is_unsent, m.created_at,
             m.sender_type, m.ai_agent, m.trigger_message_id,
             u.username AS sender_username, u.display_name AS sender_display_name, u.profile_image_url AS sender_profile_image
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.user_id
      WHERE (m.sender_id = $1 AND m.receiver_id = $2)
         OR (m.sender_id = $2 AND m.receiver_id = $1)
         OR (m.sender_id IS NULL AND (m.receiver_id = $1 OR m.receiver_id = $2))
      ORDER BY m.created_at ASC
    `;
    const res = await executePostgresSql<RawMessageRow>(sql, [userA, userB]);
    return (res.rows || []).map((row) => this.mapRowToMessage(row));
  }

  async markMessageAsRead(messageId: number, receiverUserId: number): Promise<{
    rowsAffected: number;
    readAt: Date | null;
    senderId: number | null;
  }> {
    const sql = `
      UPDATE messages
      SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP)
      WHERE message_id = $1 AND receiver_id = $2
      RETURNING read_at, sender_id
    `;
    const res = await executePostgresSql<{ read_at: Date; sender_id: number | string }>(sql, [
      messageId,
      receiverUserId
    ]);

    if (res.rows.length === 0) {
      return { rowsAffected: 0, readAt: null, senderId: null };
    }

    return {
      rowsAffected: res.rowCount,
      readAt: res.rows[0].read_at ? new Date(res.rows[0].read_at) : null,
      senderId: res.rows[0].sender_id ? Number(res.rows[0].sender_id) : null
    };
  }

  async getConversations(userId: number): Promise<ConversationSummary[]> {
    const sql = `
      WITH ranked_messages AS (
        SELECT m.message_id, m.sender_id, m.receiver_id, m.content, m.read_at, m.is_unsent, m.created_at,
               CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END AS partner_id,
               ROW_NUMBER() OVER (
                 PARTITION BY CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END
                 ORDER BY m.created_at DESC, m.message_id DESC
               ) AS rn
        FROM messages m
        WHERE m.sender_id = $1 OR m.receiver_id = $1
      )
      SELECT rm.partner_id, rm.content AS last_message, rm.is_unsent, rm.created_at AS last_message_at,
             rm.sender_id AS last_message_sender_id,
             u.username, u.display_name, u.profile_image_url,
             (SELECT COUNT(*) FROM messages WHERE sender_id = rm.partner_id AND receiver_id = $1 AND read_at IS NULL) AS unread_count
      FROM ranked_messages rm
      JOIN users u ON rm.partner_id = u.user_id
      WHERE rm.rn = 1
      ORDER BY rm.created_at DESC
    `;
    const res = await executePostgresSql<any>(sql, [userId]);
    return (res.rows || []).map((row) => ({
      otherUserId: Number(row.partner_id),
      username: row.username,
      displayName: row.display_name,
      profileImageUrl: row.profile_image_url ?? null,
      lastMessage: row.is_unsent ? 'Message unsent' : row.last_message,
      lastMessageAt: row.last_message_at ? new Date(row.last_message_at).toISOString() : null,
      unreadCount: Number(row.unread_count || 0)
    }));
  }

  async unsendMessage(
    messageId: number,
    senderId: number
  ): Promise<{ success: boolean; receiverId: number }> {
    const sql = `
      UPDATE messages
      SET is_unsent = TRUE
      WHERE message_id = $1
        AND sender_id = $2
        AND is_unsent = FALSE
      RETURNING receiver_id
    `;

    const res = await executePostgresSql<{ receiver_id: number }>(
      sql,
      [messageId, senderId]
    );

    const row = res.rows?.[0];

    if (!row) {
      return {
        success: false,
        receiverId: 0
      };
    }

    return {
      success: true,
      receiverId: Number(row.receiver_id)
    };
  }
}
