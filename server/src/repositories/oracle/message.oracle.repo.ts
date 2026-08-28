import oracledb from 'oracledb';
import { executeSql, withTransaction } from '../../db/pool.js';
import { IMessageRepository } from '../types.js';
import { ConversationSummary, Message } from '../../types/index.js';

interface RawMessageRow {
  MESSAGE_ID: number;
  SENDER_ID: number | null;
  RECEIVER_ID: number;
  USERNAME?: string | null;
  DISPLAY_NAME?: string | null;
  PROFILE_IMAGE_URL?: string | null;
  CONTENT: string;
  READ_AT?: Date | null;
  IS_UNSENT: number;
  CREATED_AT: Date;
  SENDER_TYPE?: string | null;
  AI_AGENT?: string | null;
  TRIGGER_MESSAGE_ID?: number | null;
  TRIGGER_KEY?: string | null;
}

export class OracleMessageRepository implements IMessageRepository {
  private mapRowToMessage(row: RawMessageRow): Message {
    const isUnsent = row.IS_UNSENT === 1;
    const isAi = (row.SENDER_TYPE || '').toLowerCase() === 'ai' || row.SENDER_ID === null;

    return {
      messageId: row.MESSAGE_ID,
      senderId: isAi ? null : row.SENDER_ID,
      receiverId: row.RECEIVER_ID,
      senderType: isAi ? 'ai' : 'user',
      aiAgent: isAi ? (row.AI_AGENT || 'nexa') : undefined,
      triggerMessageId: row.TRIGGER_MESSAGE_ID ?? null,
      sender: {
        userId: isAi ? 0 : Number(row.SENDER_ID),
        username: isAi ? 'nexa' : (row.USERNAME || 'user'),
        displayName: isAi ? 'NEXA AI' : (row.DISPLAY_NAME || 'User'),
        profileImageUrl: isAi ? '/nexa-ai-avatar.png' : (row.PROFILE_IMAGE_URL || undefined)
      },
      content: isUnsent ? 'Message unsent' : row.CONTENT,
      isRead: Boolean(row.READ_AT),
      isUnsent,
      createdAt: row.CREATED_AT ? row.CREATED_AT.toISOString() : new Date().toISOString()
    };
  }

  async getMessagesBetweenUsers(userA: number, userB: number): Promise<Message[]> {
    const sql = `
      SELECT m.MESSAGE_ID, m.SENDER_ID, m.RECEIVER_ID, u.USERNAME, u.DISPLAY_NAME, u.PROFILE_IMAGE_URL,
             m.CONTENT, m.READ_AT, m.IS_UNSENT, m.CREATED_AT, m.SENDER_TYPE, m.AI_AGENT, m.TRIGGER_MESSAGE_ID, m.TRIGGER_KEY
      FROM MESSAGES m
      LEFT JOIN USERS u ON m.SENDER_ID = u.USER_ID
      WHERE (m.SENDER_ID = :userA AND m.RECEIVER_ID = :userB)
         OR (m.SENDER_ID = :userB AND m.RECEIVER_ID = :userA)
         OR (m.SENDER_ID IS NULL AND (m.RECEIVER_ID = :userA OR m.RECEIVER_ID = :userB))
      ORDER BY m.MESSAGE_ID ASC
    `;
    const res = await executeSql<RawMessageRow>(sql, { userA, userB });
    return (res.rows || []).map((row: RawMessageRow) => this.mapRowToMessage(row));
  }

  async findAiResponseByTrigger(triggerKey: string, aiAgent = 'nexa'): Promise<Message | null> {
    const sql = `
      SELECT m.MESSAGE_ID, m.SENDER_ID, m.RECEIVER_ID, u.USERNAME, u.DISPLAY_NAME, u.PROFILE_IMAGE_URL,
             m.CONTENT, m.READ_AT, m.IS_UNSENT, m.CREATED_AT, m.SENDER_TYPE, m.AI_AGENT, m.TRIGGER_MESSAGE_ID, m.TRIGGER_KEY
      FROM MESSAGES m
      LEFT JOIN USERS u ON m.SENDER_ID = u.USER_ID
      WHERE m.TRIGGER_KEY = :triggerKey
        AND m.SENDER_TYPE = 'ai'
        AND m.AI_AGENT = :aiAgent
      FETCH FIRST 1 ROWS ONLY
    `;
    const res = await executeSql<RawMessageRow>(sql, { triggerKey, aiAgent });
    const row = res.rows?.[0];
    return row ? this.mapRowToMessage(row) : null;
  }

  async sendAiMessage(msg: { receiverId: number; content: string; aiAgent?: string; triggerMessageId?: number | null }): Promise<Message> {
    const agentName = msg.aiAgent || 'nexa';
    const triggerKey = msg.triggerMessageId ? `dm:${agentName}:${msg.triggerMessageId}` : null;

    // 1. Durable idempotency pre-check
    if (triggerKey) {
      const existing = await this.findAiResponseByTrigger(triggerKey, agentName);
      if (existing) {
        return existing;
      }
    }

    try {
      return await withTransaction(async (conn) => {
        const sql = `
          INSERT INTO MESSAGES (SENDER_ID, RECEIVER_ID, CONTENT, SENDER_TYPE, AI_AGENT, TRIGGER_MESSAGE_ID, TRIGGER_KEY, CREATED_AT)
          VALUES (NULL, :receiverId, :content, 'ai', :aiAgent, :triggerMessageId, :triggerKey, SYSTIMESTAMP)
          RETURNING MESSAGE_ID, CREATED_AT INTO :messageId, :createdAt
        `;
        const binds = {
          receiverId: Number(msg.receiverId),
          content: msg.content.trim(),
          aiAgent: agentName,
          triggerMessageId: msg.triggerMessageId ?? null,
          triggerKey,
          messageId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
          createdAt: { type: oracledb.DATE, dir: oracledb.BIND_OUT }
        };

        const res = await conn.execute(sql, binds);
        const outBinds = res.outBinds as any;

        const createdVal = outBinds?.createdAt?.[0];
        const createdAtStr = createdVal instanceof Date
          ? createdVal.toISOString()
          : (typeof createdVal === 'string' ? createdVal : new Date().toISOString());

        const messageId = outBinds?.messageId?.[0];

        return {
          messageId,
          senderId: null,
          receiverId: Number(msg.receiverId),
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
          createdAt: createdAtStr
        };
      });
    } catch (err: any) {
      // ORA-00001: unique constraint violated
      if (err?.errorNum === 1 || err?.message?.includes('ORA-00001') || err?.code === 'ORA-00001') {
        if (triggerKey) {
          const existing = await this.findAiResponseByTrigger(triggerKey, agentName);
          if (existing) return existing;
        }
      }
      throw err;
    }
  }

  async sendMessage(msg: { senderId: number; receiverId: number; content: string }): Promise<Message> {
    return withTransaction(async (conn) => {
      const sql = `
        INSERT INTO MESSAGES (SENDER_ID, RECEIVER_ID, CONTENT, CREATED_AT)
        VALUES (:senderId, :receiverId, :content, SYSTIMESTAMP)
        RETURNING MESSAGE_ID, CREATED_AT INTO :messageId, :createdAt
      `;
      const binds = {
        senderId: Number(msg.senderId),
        receiverId: Number(msg.receiverId),
        content: msg.content.trim(),
        messageId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
        createdAt: { type: oracledb.DATE, dir: oracledb.BIND_OUT }
      };

      const res = await conn.execute(sql, binds);
      const outBinds = res.outBinds as any;

      const createdVal = outBinds?.createdAt?.[0];
      const createdAtStr = createdVal instanceof Date
        ? createdVal.toISOString()
        : (typeof createdVal === 'string' ? createdVal : new Date().toISOString());

      let senderUsername = 'user';
      let senderDisplayName = 'User';
      let senderProfileImage: string | undefined;

      try {
        const userRes = await conn.execute(
          'SELECT USERNAME, DISPLAY_NAME, PROFILE_IMAGE_URL FROM USERS WHERE USER_ID = :senderId',
          { senderId: Number(msg.senderId) }
        );
        const userRow = userRes.rows?.[0] as any;
        if (userRow) {
          senderUsername = userRow.USERNAME || userRow[0] || 'user';
          senderDisplayName = userRow.DISPLAY_NAME || userRow[1] || 'User';
          senderProfileImage = userRow.PROFILE_IMAGE_URL || userRow[2] || undefined;
        }
      } catch {}

      return {
        messageId: Number(outBinds?.messageId?.[0]),
        senderId: Number(msg.senderId),
        receiverId: Number(msg.receiverId),
        sender: {
          userId: Number(msg.senderId),
          username: senderUsername,
          displayName: senderDisplayName,
          profileImageUrl: senderProfileImage
        },
        content: msg.content.trim(),
        isRead: false,
        createdAt: createdAtStr
      };
    });
  }

  async markMessageAsRead(messageId: number, authenticatedUserId: number): Promise<{ rowsAffected: number; readAt: Date | null; senderId: number | null }> {
    return withTransaction(async (conn) => {
      const sql = `
        UPDATE MESSAGES
        SET READ_AT = COALESCE(READ_AT, SYSTIMESTAMP)
        WHERE MESSAGE_ID = :messageId
          AND RECEIVER_ID = :authenticatedUserId
          AND READ_AT IS NULL
      `;
      const res = await conn.execute(
        `${sql} RETURNING SENDER_ID, READ_AT INTO :senderId, :readAt`,
        {
          messageId,
          authenticatedUserId,
          senderId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
          readAt: { type: oracledb.DATE, dir: oracledb.BIND_OUT }
        }
      );
      let readAt: Date | null = null;
      let senderId: number | null = null;
      if (res.rowsAffected && res.rowsAffected > 0) {
        const outBinds = res.outBinds as any;
        senderId = Number(outBinds.senderId[0]);
        readAt = outBinds.readAt[0];
      }
      return { rowsAffected: res.rowsAffected || 0, readAt, senderId };
    });
  }

  async markAsRead(receiverId: number, senderId: number): Promise<void> {
    return withTransaction(async (conn) => {
      const sql = `
        UPDATE MESSAGES
        SET READ_AT = COALESCE(READ_AT, SYSTIMESTAMP)
        WHERE RECEIVER_ID = :receiverId
          AND SENDER_ID = :senderId
          AND READ_AT IS NULL
      `;
      await conn.execute(sql, { receiverId, senderId });
    });
  }

  async getConversations(userId: number): Promise<ConversationSummary[]> {
    const sql = `
      SELECT
          other_user_id,
          u.username,
          u.display_name,
          u.profile_image_url,
          m.content AS last_message,
          m.is_unsent,
          m.created_at AS last_message_at,
          (SELECT COUNT(*) FROM MESSAGES WHERE SENDER_ID = other_user_id AND RECEIVER_ID = :userId AND READ_AT IS NULL) AS unread_count
      FROM (
          SELECT
              CASE WHEN SENDER_ID = :userId THEN RECEIVER_ID ELSE SENDER_ID END AS other_user_id,
              MAX(MESSAGE_ID) as max_id
          FROM MESSAGES
          WHERE SENDER_ID = :userId OR RECEIVER_ID = :userId
          GROUP BY CASE WHEN SENDER_ID = :userId THEN RECEIVER_ID ELSE SENDER_ID END
      ) conv
      JOIN MESSAGES m ON conv.max_id = m.MESSAGE_ID
      JOIN USERS u ON conv.other_user_id = u.USER_ID
      ORDER BY m.MESSAGE_ID DESC
    `;
    const res = await executeSql(sql, { userId });
    return (res.rows || []).map((row: any) => ({
      otherUserId: Number(row.OTHER_USER_ID),
      username: row.USERNAME,
      displayName: row.DISPLAY_NAME,
      profileImageUrl: row.PROFILE_IMAGE_URL,
      lastMessage: Number(row.IS_UNSENT) === 1 ? 'Message unsent' : row.LAST_MESSAGE,
      lastMessageAt: row.LAST_MESSAGE_AT ? row.LAST_MESSAGE_AT.toISOString() : null,
      unreadCount: Number(row.UNREAD_COUNT || 0)
    }));
  }

  async unsendMessage(messageId: number, senderId: number): Promise<{ success: boolean; receiverId: number }> {
    return withTransaction(async (conn) => {
      const selectSql = `
        SELECT SENDER_ID, RECEIVER_ID, CREATED_AT, IS_UNSENT
        FROM MESSAGES
        WHERE MESSAGE_ID = :messageId
      `;
      const selectRes = await conn.execute(selectSql, { messageId });
      const row = selectRes.rows?.[0] as any;
      if (!row) {
        throw { statusCode: 404, code: 'MESSAGE_NOT_FOUND', message: 'Message not found' };
      }

      const dbSenderId = Number(row.SENDER_ID || row[0]);
      const dbReceiverId = Number(row.RECEIVER_ID || row[1]);
      const dbCreatedAt = row.CREATED_AT || row[2];
      const dbIsUnsent = Number(row.IS_UNSENT || row[3]);

      if (dbSenderId !== senderId) {
        throw { statusCode: 403, code: 'FORBIDDEN', message: 'You can only unsend your own messages' };
      }

      if (dbIsUnsent === 1) {
        return { success: true, receiverId: dbReceiverId };
      }

      // Time window check (1 hour)
      const messageTime = new Date(dbCreatedAt).getTime();
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      if (messageTime < oneHourAgo) {
        throw { statusCode: 400, code: 'UNSEND_WINDOW_EXPIRED', message: 'You can only unsend messages within 1 hour of sending.' };
      }

      const updateSql = `
        UPDATE MESSAGES
        SET IS_UNSENT = 1
        WHERE MESSAGE_ID = :messageId
      `;
      await conn.execute(updateSql, { messageId });
      return { success: true, receiverId: dbReceiverId };
    });
  }
}
