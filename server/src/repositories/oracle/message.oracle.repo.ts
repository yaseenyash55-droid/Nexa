import oracledb from 'oracledb';
import { executeSql, withTransaction } from '../../db/pool.js';
import { IMessageRepository } from '../types.js';
import { ConversationSummary, Message } from '../../types/index.js';

interface RawMessageRow {
  MESSAGE_ID: number;
  SENDER_ID: number;
  RECEIVER_ID: number;
  USERNAME: string;
  DISPLAY_NAME: string;
  PROFILE_IMAGE_URL?: string | null;
  CONTENT: string;
  READ_AT?: Date | null;
  CREATED_AT: Date;
}

export class OracleMessageRepository implements IMessageRepository {
  private mapRowToMessage(row: RawMessageRow): Message {
    return {
      messageId: row.MESSAGE_ID,
      senderId: row.SENDER_ID,
      receiverId: row.RECEIVER_ID,
      sender: {
        userId: row.SENDER_ID,
        username: row.USERNAME || 'user',
        displayName: row.DISPLAY_NAME || 'User',
        profileImageUrl: row.PROFILE_IMAGE_URL
      },
      content: row.CONTENT,
      isRead: Boolean(row.READ_AT),
      createdAt: row.CREATED_AT ? row.CREATED_AT.toISOString() : new Date().toISOString()
    };
  }

  async getMessagesBetweenUsers(userA: number, userB: number): Promise<Message[]> {
    const sql = `
      SELECT m.MESSAGE_ID, m.SENDER_ID, m.RECEIVER_ID, u.USERNAME, u.DISPLAY_NAME, u.PROFILE_IMAGE_URL,
             m.CONTENT, m.READ_AT, m.CREATED_AT
      FROM MESSAGES m
      JOIN USERS u ON m.SENDER_ID = u.USER_ID
      WHERE (m.SENDER_ID = :userA AND m.RECEIVER_ID = :userB)
         OR (m.SENDER_ID = :userB AND m.RECEIVER_ID = :userA)
      ORDER BY m.MESSAGE_ID ASC
    `;
    const res = await executeSql<RawMessageRow>(sql, { userA, userB });
    return (res.rows || []).map((row: RawMessageRow) => this.mapRowToMessage(row));
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
      lastMessage: row.LAST_MESSAGE,
      lastMessageAt: row.LAST_MESSAGE_AT ? row.LAST_MESSAGE_AT.toISOString() : null,
      unreadCount: Number(row.UNREAD_COUNT || 0)
    }));
  }
}
