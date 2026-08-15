import { Broadcast, Message } from '../types/index.js';
import { executeSql, withTransaction } from '../db/pool.js';

export interface BroadcastRepository {
  createBroadcast(senderId: number, recipientIds: number[], content: string, title?: string): Promise<Broadcast>;
  getUserBroadcasts(senderId: number): Promise<Broadcast[]>;
}

const mockBroadcasts: Broadcast[] = [
  {
    broadcastId: 1,
    senderId: 1,
    title: 'Weekly Announcement',
    content: 'Hello team! Next release is scheduled for Friday.',
    recipientsCount: 2,
    recipientIds: [2, 3],
    createdAt: new Date(Date.now() - 7200000).toISOString()
  }
];

let nextBroadcastId = 2;

export class MockBroadcastRepository implements BroadcastRepository {
  async createBroadcast(senderId: number, recipientIds: number[], content: string, title?: string): Promise<Broadcast> {
    const broadcastId = nextBroadcastId++;
    const broadcast: Broadcast = {
      broadcastId,
      senderId,
      title: title?.trim() || 'Broadcast Message',
      content: content.trim(),
      recipientsCount: recipientIds.length,
      recipientIds,
      createdAt: new Date().toISOString()
    };
    mockBroadcasts.push(broadcast);
    return broadcast;
  }

  async getUserBroadcasts(senderId: number): Promise<Broadcast[]> {
    return mockBroadcasts
      .filter((b) => b.senderId === senderId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}

export class OracleBroadcastRepository implements BroadcastRepository {
  async createBroadcast(senderId: number, recipientIds: number[], content: string, title?: string): Promise<Broadcast> {
    return withTransaction(async (conn: any) => {
      const result = await conn.execute(
        `INSERT INTO BROADCASTS (SENDER_ID, TITLE, CONTENT, RECIPIENTS_COUNT, CREATED_AT)
         VALUES (:1, :2, :3, :4, SYSTIMESTAMP)
         RETURNING BROADCAST_ID, CREATED_AT INTO :5, :6`,
        [
          senderId,
          title?.trim() || 'Broadcast Message',
          content.trim(),
          recipientIds.length,
          { dir: 3003, type: 2002 },
          { dir: 3003, type: 2007 }
        ]
      );

      const broadcastId = (result.outBinds as any)?.[0]?.[0];
      const createdAt = (result.outBinds as any)?.[1]?.[0]?.toISOString() || new Date().toISOString();

      for (const rId of recipientIds) {
        await conn.execute(
          `INSERT INTO BROADCAST_RECIPIENTS (BROADCAST_ID, RECIPIENT_USER_ID)
           VALUES (:1, :2)`,
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
    const res = await executeSql(
      `SELECT BROADCAST_ID, SENDER_ID, TITLE, CONTENT, RECIPIENTS_COUNT, CREATED_AT
       FROM BROADCASTS
       WHERE SENDER_ID = :1
       ORDER BY CREATED_AT DESC`,
      [senderId]
    );

    const rows = res.rows || [];
    return rows.map((r: any) => ({
      broadcastId: r.BROADCAST_ID,
      senderId: r.SENDER_ID,
      title: r.TITLE,
      content: r.CONTENT,
      recipientsCount: r.RECIPIENTS_COUNT,
      recipientIds: [],
      createdAt: new Date(r.CREATED_AT).toISOString()
    }));
  }
}
