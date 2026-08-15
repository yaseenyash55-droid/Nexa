import oracledb from 'oracledb';
import { executeSql, withTransaction } from '../../db/pool.js';
import { IMessageRepository } from '../types.js';
import { Message } from '../../types/index.js';

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
        senderId: msg.senderId,
        receiverId: msg.receiverId,
        content: msg.content.trim(),
        messageId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
        createdAt: { type: oracledb.DATE, dir: oracledb.BIND_OUT }
      };

      const res = await conn.execute(sql, binds);
      const outBinds = res.outBinds as any;

      return {
        messageId: outBinds.messageId[0],
        senderId: msg.senderId,
        receiverId: msg.receiverId,
        sender: {
          userId: msg.senderId,
          username: 'sender',
          displayName: 'Sender'
        },
        content: msg.content.trim(),
        isRead: false,
        createdAt: outBinds.createdAt[0].toISOString()
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
}
