import { executePostgresSql, withPostgresTransaction } from '../../db/postgres.pool.js';
import { BroadcastRepository } from '../broadcast.repository.js';
import { Broadcast } from '../../types/index.js';

export class PostgresBroadcastRepository implements BroadcastRepository {
  async createBroadcast(senderId: number, recipientIds: number[], content: string, title?: string, attachments?: any[]): Promise<Broadcast> {
    return withPostgresTransaction(async (conn) => {
      const result = await conn.query(
        `INSERT INTO broadcasts (sender_id, title, content, recipients_count, created_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         RETURNING broadcast_id, created_at`,
        [
          senderId,
          title?.trim() || 'Broadcast Message',
          content?.trim() || '',
          recipientIds.length
        ]
      );

      const broadcastId = Number(result.rows[0].broadcast_id);
      const createdAt = new Date(result.rows[0].created_at).toISOString();

      const savedAttachments = [];
      if (attachments && attachments.length > 0) {
        for (const att of attachments) {
          const attResult = await conn.query(
            `INSERT INTO message_attachments (
              broadcast_id, attachment_type, media_id,
              music_provider, music_track_id, music_title,
              music_artist, music_artwork_url, music_audio_url, music_duration
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *`,
            [
              broadcastId, att.type, att.mediaId || null,
              att.music?.provider || null, att.music?.id || null,
              att.music?.title || null, att.music?.artist || null,
              att.music?.artworkUrl || null, att.music?.audioUrl || null,
              att.music?.duration || null
            ]
          );
          const dbAtt = attResult.rows[0];
          savedAttachments.push({
            type: dbAtt.attachment_type,
            mediaId: dbAtt.media_id,
            music: dbAtt.music_track_id ? {
              provider: dbAtt.music_provider,
              id: dbAtt.music_track_id,
              title: dbAtt.music_title,
              artist: dbAtt.music_artist,
              artworkUrl: dbAtt.music_artwork_url,
              audioUrl: dbAtt.music_audio_url,
              duration: dbAtt.music_duration
            } : undefined
          });
        }
      }

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
        content: content?.trim() || '',
        attachments: savedAttachments.length > 0 ? savedAttachments : undefined,
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

    const broadcasts: Broadcast[] = (res.rows || []).map((r: any) => ({
      broadcastId: Number(r.broadcast_id),
      senderId: Number(r.sender_id),
      title: r.title,
      content: r.content,
      recipientsCount: Number(r.recipients_count || 0),
      recipientIds: [],
      createdAt: new Date(r.created_at).toISOString(),
      attachments: undefined
    }));

    if (broadcasts.length > 0) {
      const broadcastIds = broadcasts.map(b => b.broadcastId);
      const attSql = `
        SELECT broadcast_id, attachment_type, media_id,
               music_provider, music_track_id, music_title,
               music_artist, music_artwork_url, music_audio_url, music_duration
        FROM message_attachments
        WHERE broadcast_id = ANY($1::bigint[])
      `;
      const attRes = await executePostgresSql<any>(attSql, [broadcastIds]);
      const attachmentsByBcastId: Record<number, any[]> = {};

      for (const row of (attRes.rows || [])) {
        const bId = Number(row.broadcast_id);
        if (!attachmentsByBcastId[bId]) {
          attachmentsByBcastId[bId] = [];
        }
        attachmentsByBcastId[bId].push({
          type: row.attachment_type,
          mediaId: row.media_id,
          music: row.music_track_id ? {
            provider: row.music_provider,
            id: row.music_track_id,
            title: row.music_title,
            artist: row.music_artist,
            artworkUrl: row.music_artwork_url,
            audioUrl: row.music_audio_url,
            duration: row.music_duration
          } : undefined
        });
      }

      for (const b of broadcasts) {
        if (attachmentsByBcastId[b.broadcastId]) {
          b.attachments = attachmentsByBcastId[b.broadcastId];
        }
      }
    }

    return broadcasts;
  }
}
