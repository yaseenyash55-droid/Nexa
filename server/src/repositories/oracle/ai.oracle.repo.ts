import { IAiRepository, AiConversation, AiMessage } from '../../types/ai.types.js';
import { executeSql } from '../../db/pool.js';
import oracledb from 'oracledb';

export class OracleAiRepository implements IAiRepository {
  public async createConversation(userId: number, title: string): Promise<AiConversation> {
    const trimmedTitle = title.trim().substring(0, 120) || 'New Conversation';
    const sql = `
      INSERT INTO AI_CONVERSATIONS (USER_ID, TITLE)
      VALUES (:userId, :title)
      RETURNING CONVERSATION_ID, USER_ID, TITLE, CREATED_AT, UPDATED_AT
      INTO :out_id, :out_user_id, :out_title, :out_created_at, :out_updated_at
    `;

    const binds = {
      userId,
      title: trimmedTitle,
      out_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
      out_user_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
      out_title: { type: oracledb.STRING, dir: oracledb.BIND_OUT },
      out_created_at: { type: oracledb.DATE, dir: oracledb.BIND_OUT },
      out_updated_at: { type: oracledb.DATE, dir: oracledb.BIND_OUT }
    };

    const result = await executeSql(sql, binds, { autoCommit: true });
    const outBinds = result.outBinds as Record<string, any>;

    return {
      conversationId: outBinds.out_id[0],
      userId: outBinds.out_user_id[0],
      title: outBinds.out_title[0],
      createdAt: outBinds.out_created_at[0],
      updatedAt: outBinds.out_updated_at[0]
    };
  }

  public async getConversationById(conversationId: number, userId: number): Promise<AiConversation | null> {
    const sql = `
      SELECT CONVERSATION_ID, USER_ID, TITLE, CREATED_AT, UPDATED_AT
      FROM AI_CONVERSATIONS
      WHERE CONVERSATION_ID = :conversationId AND USER_ID = :userId
    `;

    const result = await executeSql<any>(sql, { conversationId, userId });
    if (!result.rows || result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      conversationId: Number(row.CONVERSATION_ID ?? row[0]),
      userId: Number(row.USER_ID ?? row[1]),
      title: row.TITLE ?? row[2],
      createdAt: new Date(row.CREATED_AT ?? row[3]),
      updatedAt: new Date(row.UPDATED_AT ?? row[4])
    };
  }

  public async getUserConversations(userId: number, limit = 50): Promise<AiConversation[]> {
    const boundedLimit = Math.min(Math.max(limit, 1), 100);
    const sql = `
      SELECT CONVERSATION_ID, USER_ID, TITLE, CREATED_AT, UPDATED_AT
      FROM AI_CONVERSATIONS
      WHERE USER_ID = :userId
      ORDER BY UPDATED_AT DESC
      FETCH NEXT :boundedLimit ROWS ONLY
    `;

    const result = await executeSql<any>(sql, { userId, boundedLimit });
    if (!result.rows) return [];

    return result.rows.map((row: any) => ({
      conversationId: Number(row.CONVERSATION_ID ?? row[0]),
      userId: Number(row.USER_ID ?? row[1]),
      title: row.TITLE ?? row[2],
      createdAt: new Date(row.CREATED_AT ?? row[3]),
      updatedAt: new Date(row.UPDATED_AT ?? row[4])
    }));
  }

  public async saveMessage(
    conversationId: number,
    role: 'system' | 'user' | 'assistant',
    content: string
  ): Promise<AiMessage> {
    const sql = `
      INSERT INTO AI_MESSAGES (CONVERSATION_ID, ROLE, CONTENT)
      VALUES (:conversationId, :role, :content)
      RETURNING MESSAGE_ID, CONVERSATION_ID, ROLE, CONTENT, CREATED_AT
      INTO :out_id, :out_conv_id, :out_role, :out_content, :out_created_at
    `;

    const binds = {
      conversationId,
      role,
      content,
      out_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
      out_conv_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
      out_role: { type: oracledb.STRING, dir: oracledb.BIND_OUT },
      out_content: { type: oracledb.STRING, dir: oracledb.BIND_OUT },
      out_created_at: { type: oracledb.DATE, dir: oracledb.BIND_OUT }
    };

    const result = await executeSql(sql, binds, { autoCommit: true });
    const outBinds = result.outBinds as Record<string, any>;

    // Touch conversation updated_at
    await this.touchConversation(conversationId);

    return {
      messageId: outBinds.out_id[0],
      conversationId: outBinds.out_conv_id[0],
      role: outBinds.out_role[0] as 'system' | 'user' | 'assistant',
      content: outBinds.out_content[0],
      createdAt: outBinds.out_created_at[0]
    };
  }

  public async getConversationMessages(conversationId: number, userId: number): Promise<AiMessage[]> {
    // Check conversation ownership first
    const conv = await this.getConversationById(conversationId, userId);
    if (!conv) {
      return [];
    }

    const sql = `
      SELECT MESSAGE_ID, CONVERSATION_ID, ROLE, CONTENT, CREATED_AT
      FROM AI_MESSAGES
      WHERE CONVERSATION_ID = :conversationId
      ORDER BY CREATED_AT ASC, MESSAGE_ID ASC
    `;

    const result = await executeSql<any>(sql, { conversationId });
    if (!result.rows) return [];

    return result.rows.map((row: any) => ({
      messageId: Number(row.MESSAGE_ID ?? row[0]),
      conversationId: Number(row.CONVERSATION_ID ?? row[1]),
      role: (row.ROLE ?? row[2]) as 'system' | 'user' | 'assistant',
      content: row.CONTENT ?? row[3],
      createdAt: new Date(row.CREATED_AT ?? row[4])
    }));
  }

  public async touchConversation(conversationId: number): Promise<void> {
    const sql = `
      UPDATE AI_CONVERSATIONS
      SET UPDATED_AT = SYSTIMESTAMP
      WHERE CONVERSATION_ID = :conversationId
    `;
    await executeSql(sql, { conversationId }, { autoCommit: true });
  }

  public async deleteConversation(conversationId: number, userId: number): Promise<boolean> {
    const sql = `
      DELETE FROM AI_CONVERSATIONS
      WHERE CONVERSATION_ID = :conversationId AND USER_ID = :userId
    `;
    const result = await executeSql(sql, { conversationId, userId }, { autoCommit: true });
    return (result.rowsAffected || 0) > 0;
  }
}
