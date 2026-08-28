import oracledb from 'oracledb';
import { Broadcast } from '../types/index.js';
import { executeSql, withTransaction } from '../db/pool.js';

export interface BroadcastRepository {
  createBroadcast(senderId: number, recipientIds: number[], content: string, title?: string, attachments?: any[]): Promise<Broadcast>;
  getUserBroadcasts(senderId: number): Promise<Broadcast[]>;
}

export class OracleBroadcastRepository implements BroadcastRepository {
  async createBroadcast(senderId: number, recipientIds: number[], content: string, title?: string, attachments?: any[]): Promise<Broadcast> {
    return withTransaction(async (conn: any) => {
      const result = await conn.execute(
        `INSERT INTO BROADCASTS (SENDER_ID, TITLE, CONTENT, RECIPIENTS_COUNT, CREATED_AT)
         VALUES (:1, :2, :3, :4, SYSTIMESTAMP)
         RETURNING BROADCAST_ID, CREATED_AT INTO :5, :6`,
        [
          senderId,
          title?.trim() || 'Broadcast Message',
          content?.trim() || '',
          recipientIds.length,
          { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
          { dir: oracledb.BIND_OUT, type: oracledb.DATE }
        ]
      );

      const broadcastId = (result.outBinds as any)?.[0]?.[0];
      const createdAt = (result.outBinds as any)?.[1]?.[0]?.toISOString() || new Date().toISOString();

      const savedAttachments = [];
      if (attachments && attachments.length > 0) {
        for (const att of attachments) {
          const attSql = `
            INSERT INTO MESSAGE_ATTACHMENTS (
              BROADCAST_ID, ATTACHMENT_TYPE, MEDIA_ID,
              MUSIC_PROVIDER, MUSIC_TRACK_ID, MUSIC_TITLE,
              MUSIC_ARTIST, MUSIC_ARTWORK_URL, MUSIC_AUDIO_URL, MUSIC_DURATION
            ) VALUES (
              :broadcastId, :attachmentType, :mediaId,
              :musicProvider, :musicTrackId, :musicTitle,
              :musicArtist, :musicArtworkUrl, :musicAudioUrl, :musicDuration
            )
            RETURNING ATTACHMENT_ID INTO :attachmentId
          `;
          const attBinds = {
            broadcastId,
            attachmentType: att.type,
            mediaId: att.mediaId || null,
            musicProvider: att.music?.provider || null,
            musicTrackId: att.music?.id || null,
            musicTitle: att.music?.title || null,
            musicArtist: att.music?.artist || null,
            musicArtworkUrl: att.music?.artworkUrl || null,
            musicAudioUrl: att.music?.audioUrl || null,
            musicDuration: att.music?.duration || null,
            attachmentId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
          };
          await conn.execute(attSql, attBinds);
          savedAttachments.push(att);
        }
      }

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
        content: content?.trim() || '',
        attachments: savedAttachments.length > 0 ? savedAttachments : undefined,
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
    const broadcasts: Broadcast[] = rows.map((r: any) => ({
      broadcastId: r.BROADCAST_ID,
      senderId: r.SENDER_ID,
      title: r.TITLE,
      content: r.CONTENT,
      recipientsCount: r.RECIPIENTS_COUNT,
      recipientIds: [],
      createdAt: new Date(r.CREATED_AT).toISOString(),
      attachments: undefined
    }));

    if (broadcasts.length > 0) {
      const broadcastIds = broadcasts.map(b => b.broadcastId);
      const idList = broadcastIds.join(',');
      if (idList) {
        const attSql = `
          SELECT BROADCAST_ID, ATTACHMENT_TYPE, MEDIA_ID,
                 MUSIC_PROVIDER, MUSIC_TRACK_ID, MUSIC_TITLE,
                 MUSIC_ARTIST, MUSIC_ARTWORK_URL, MUSIC_AUDIO_URL, MUSIC_DURATION
          FROM MESSAGE_ATTACHMENTS
          WHERE BROADCAST_ID IN (${idList})
        `;
        const attRes = await executeSql<any>(attSql);
        const attachmentsByBcastId: Record<number, any[]> = {};

        for (const row of (attRes.rows || [])) {
          const bId = Number(row.BROADCAST_ID);
          if (!attachmentsByBcastId[bId]) {
            attachmentsByBcastId[bId] = [];
          }
          attachmentsByBcastId[bId].push({
            type: row.ATTACHMENT_TYPE,
            mediaId: row.MEDIA_ID,
            music: row.MUSIC_TRACK_ID ? {
              provider: row.MUSIC_PROVIDER,
              id: row.MUSIC_TRACK_ID,
              title: row.MUSIC_TITLE,
              artist: row.MUSIC_ARTIST,
              artworkUrl: row.MUSIC_ARTWORK_URL,
              audioUrl: row.MUSIC_AUDIO_URL,
              duration: row.MUSIC_DURATION
            } : undefined
          });
        }

        for (const b of broadcasts) {
          if (attachmentsByBcastId[b.broadcastId]) {
            b.attachments = attachmentsByBcastId[b.broadcastId];
          }
        }
      }
    }

    return broadcasts;
  }
}
