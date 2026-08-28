import { executePostgresSql, withPostgresTransaction } from '../../db/postgres.pool.js';
import { GroupRepository } from '../group.repository.js';
import { Group, GroupMember, GroupMessage, CreateGroupParams } from '../../types/index.js';

export class PostgresGroupRepository implements GroupRepository {
  async createGroup(params: CreateGroupParams): Promise<Group> {
    return withPostgresTransaction(async (conn) => {
      // 1. Insert Group record
      const groupRes = await conn.query(
        `INSERT INTO groups (name, description, created_by, avatar_url, created_at)
         VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
         RETURNING group_id, created_at`,
        [
          params.name.trim(),
          params.description?.trim() || null,
          params.createdBy,
          params.avatarUrl || null
        ]
      );

      const groupId = Number(groupRes.rows[0].group_id);
      const createdAt = new Date(groupRes.rows[0].created_at).toISOString();

      // 2. Add creator as ADMIN
      await conn.query(
        `INSERT INTO group_members (group_id, user_id, role, joined_at)
         VALUES ($1, $2, 'ADMIN', CURRENT_TIMESTAMP)`,
        [groupId, params.createdBy]
      );

      // 3. Add members
      const uniqueMemberIds = Array.isArray(params.memberIds)
        ? Array.from(new Set(params.memberIds.map(Number).filter((id) => !isNaN(id) && id > 0 && id !== params.createdBy)))
        : [];

      for (const mId of uniqueMemberIds) {
        await conn.query(
          `INSERT INTO group_members (group_id, user_id, role, joined_at)
           VALUES ($1, $2, 'MEMBER', CURRENT_TIMESTAMP)
           ON CONFLICT (group_id, user_id) DO NOTHING`,
          [groupId, mId]
        );
      }

      return {
        groupId,
        name: params.name.trim(),
        description: params.description?.trim() || null,
        createdBy: params.createdBy,
        avatarUrl: params.avatarUrl || null,
        createdAt,
        membersCount: 1 + uniqueMemberIds.length,
        lastMessage: null
      };
    });
  }

  async getUserGroups(userId: number): Promise<Group[]> {
    const res = await executePostgresSql(
      `SELECT g.group_id, g.name, g.description, g.created_by, g.avatar_url, g.created_at,
              (SELECT COUNT(*) FROM group_members gm WHERE gm.group_id = g.group_id) AS members_count
       FROM groups g
       INNER JOIN group_members gm ON g.group_id = gm.group_id
       WHERE gm.user_id = $1
       ORDER BY g.created_at DESC`,
      [userId]
    );

    return (res.rows || []).map((r: any) => ({
      groupId: Number(r.group_id),
      name: r.name,
      description: r.description,
      createdBy: Number(r.created_by),
      avatarUrl: r.avatar_url,
      createdAt: new Date(r.created_at).toISOString(),
      membersCount: Number(r.members_count || 0)
    }));
  }

  async getGroupById(groupId: number): Promise<Group | null> {
    const res = await executePostgresSql(
      `SELECT group_id, name, description, created_by, avatar_url, created_at,
              (SELECT COUNT(*) FROM group_members WHERE group_id = $1) AS members_count
       FROM groups
       WHERE group_id = $1`,
      [groupId]
    );

    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
      groupId: Number(r.group_id),
      name: r.name,
      description: r.description,
      createdBy: Number(r.created_by),
      avatarUrl: r.avatar_url,
      createdAt: new Date(r.created_at).toISOString(),
      membersCount: Number(r.members_count || 0)
    };
  }

  async getGroupMembers(groupId: number): Promise<GroupMember[]> {
    const res = await executePostgresSql(
      `SELECT gm.group_id, gm.user_id, gm.role, gm.joined_at,
              u.username, u.display_name, u.profile_image_url
       FROM group_members gm
       INNER JOIN users u ON gm.user_id = u.user_id
       WHERE gm.group_id = $1
       ORDER BY gm.joined_at ASC`,
      [groupId]
    );

    return (res.rows || []).map((r: any) => ({
      groupId: Number(r.group_id),
      userId: Number(r.user_id),
      role: r.role,
      joinedAt: new Date(r.joined_at).toISOString(),
      user: {
        userId: Number(r.user_id),
        username: r.username,
        displayName: r.display_name,
        profileImageUrl: r.profile_image_url
      }
    }));
  }

  async addGroupMember(groupId: number, userId: number, role: 'ADMIN' | 'MEMBER' = 'MEMBER'): Promise<void> {
    await executePostgresSql(
      `INSERT INTO group_members (group_id, user_id, role, joined_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (group_id, user_id) DO NOTHING`,
      [groupId, userId, role]
    );
  }

  async removeGroupMember(groupId: number, userId: number): Promise<boolean> {
    const res = await executePostgresSql(
      `DELETE FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, userId]
    );
    return Boolean(res.rowCount && res.rowCount > 0);
  }

  async updateGroupSettings(groupId: number, settings: { onlyAdminsCanPost?: boolean; name?: string; description?: string }): Promise<void> {
    if (settings.name || settings.description !== undefined) {
      await executePostgresSql(
        `UPDATE groups SET name = COALESCE($1, name), description = COALESCE($2, description) WHERE group_id = $3`,
        [settings.name || null, settings.description || null, groupId]
      );
    }
  }

  async deleteGroup(groupId: number): Promise<boolean> {
    return withPostgresTransaction(async (conn) => {
      await conn.query(`DELETE FROM group_messages WHERE group_id = $1`, [groupId]);
      await conn.query(`DELETE FROM group_members WHERE group_id = $1`, [groupId]);
      const res = await conn.query(`DELETE FROM groups WHERE group_id = $1`, [groupId]);
      return Boolean(res.rowCount && res.rowCount > 0);
    });
  }

  async getGroupMessages(groupId: number): Promise<GroupMessage[]> {
    const res = await executePostgresSql(
      `SELECT gm.message_id, gm.group_id, gm.sender_id, gm.content, gm.created_at, gm.sender_type, gm.ai_agent, gm.trigger_message_id,
              u.username, u.display_name, u.profile_image_url
       FROM group_messages gm
       LEFT JOIN users u ON gm.sender_id = u.user_id
       WHERE gm.group_id = $1
       ORDER BY gm.created_at ASC`,
      [groupId]
    );

    const messages: GroupMessage[] = (res.rows || []).map((r: any) => {
      const isAi = (r.sender_type || '').toLowerCase() === 'ai' || r.sender_id === null;
      return {
        messageId: Number(r.message_id),
        groupId: Number(r.group_id),
        senderId: isAi ? null : Number(r.sender_id),
        senderType: isAi ? 'ai' : 'user',
        aiAgent: isAi ? (r.ai_agent || 'nexa') : undefined,
        triggerMessageId: r.trigger_message_id ? Number(r.trigger_message_id) : null,
        content: r.content,
        attachments: undefined,
        createdAt: new Date(r.created_at).toISOString(),
        sender: {
          userId: isAi ? 0 : Number(r.sender_id),
          username: isAi ? 'nexa' : (r.username || 'user'),
          displayName: isAi ? 'NEXA AI' : (r.display_name || 'User'),
          profileImageUrl: isAi ? '/nexa-ai-avatar.png' : (r.profile_image_url || null)
        }
      };
    });

    if (messages.length > 0) {
      const msgIds = messages.map((m) => m.messageId);
      const attSql = `
        SELECT message_id, attachment_type, media_id,
               music_provider, music_track_id, music_title,
               music_artist, music_artwork_url, music_audio_url, music_duration
        FROM message_attachments
        WHERE group_message_id = ANY($1::bigint[])
      `;
      const attRes = await executePostgresSql<any>(attSql, [msgIds]);
      const attachmentsByMsgId: Record<number, any[]> = {};

      for (const row of (attRes.rows || [])) {
        const mId = Number(row.message_id);
        if (!attachmentsByMsgId[mId]) {
          attachmentsByMsgId[mId] = [];
        }
        attachmentsByMsgId[mId].push({
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

      for (const m of messages) {
        if (attachmentsByMsgId[m.messageId]) {
          m.attachments = attachmentsByMsgId[m.messageId];
        }
      }
    }

    return messages;
  }

  async findAiGroupResponseByTrigger(groupId: number, triggerMessageId: number, aiAgent = 'nexa'): Promise<GroupMessage | null> {
    const res = await executePostgresSql(
      `SELECT gm.message_id, gm.group_id, gm.sender_id, gm.content, gm.created_at, gm.sender_type, gm.ai_agent, gm.trigger_message_id,
              u.username, u.display_name, u.profile_image_url
       FROM group_messages gm
       LEFT JOIN users u ON gm.sender_id = u.user_id
       WHERE gm.group_id = $1
         AND gm.trigger_message_id = $2
         AND gm.sender_type = 'ai'
         AND gm.ai_agent = $3
       LIMIT 1`,
      [groupId, triggerMessageId, aiAgent]
    );

    const row = (res.rows || [])[0] as any;
    if (!row) return null;

    return {
      messageId: Number(row.message_id),
      groupId: Number(row.group_id),
      senderId: null,
      senderType: 'ai',
      aiAgent,
      triggerMessageId: row.trigger_message_id ? Number(row.trigger_message_id) : null,
      content: row.content,
      createdAt: new Date(row.created_at).toISOString(),
      sender: {
        userId: 0,
        username: 'nexa',
        displayName: 'NEXA AI',
        profileImageUrl: '/nexa-ai-avatar.png'
      }
    };
  }

  async sendAiGroupMessage(groupId: number, content: string, aiAgent = 'nexa', triggerMessageId?: number | null): Promise<GroupMessage> {
    const agentName = aiAgent || 'nexa';

    if (triggerMessageId) {
      const existing = await this.findAiGroupResponseByTrigger(groupId, triggerMessageId, agentName);
      if (existing) return existing;
    }

    return withPostgresTransaction(async (conn) => {
      const result = await conn.query(
        `INSERT INTO group_messages (group_id, sender_id, content, sender_type, ai_agent, trigger_message_id, created_at)
         VALUES ($1, NULL, $2, 'ai', $3, $4, CURRENT_TIMESTAMP)
         ON CONFLICT (trigger_message_id, ai_agent) WHERE trigger_message_id IS NOT NULL AND sender_type = 'ai'
         DO UPDATE SET content = group_messages.content
         RETURNING message_id, created_at, trigger_message_id`,
        [groupId, content.trim(), agentName, triggerMessageId ?? null]
      );

      const messageId = Number(result.rows[0].message_id);
      const createdAt = new Date(result.rows[0].created_at).toISOString();

      return {
        messageId,
        groupId,
        senderId: null,
        senderType: 'ai',
        aiAgent: agentName,
        triggerMessageId: triggerMessageId ?? null,
        content: content.trim(),
        createdAt,
        sender: {
          userId: 0,
          username: 'nexa',
          displayName: 'NEXA AI',
          profileImageUrl: '/nexa-ai-avatar.png'
        }
      };
    });
  }

  async sendGroupMessage(groupId: number, senderId: number, content: string, attachments?: any[]): Promise<GroupMessage> {
    return withPostgresTransaction(async (conn) => {
      const result = await conn.query(
        `INSERT INTO group_messages (group_id, sender_id, content, created_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         RETURNING message_id, created_at`,
        [groupId, senderId, content.trim()]
      );

      const messageId = Number(result.rows[0].message_id);
      const createdAt = new Date(result.rows[0].created_at).toISOString();

      const savedAttachments = [];
      if (attachments && attachments.length > 0) {
        for (const att of attachments) {
          const attResult = await conn.query(
            `INSERT INTO message_attachments (
              group_message_id, attachment_type, media_id,
              music_provider, music_track_id, music_title,
              music_artist, music_artwork_url, music_audio_url, music_duration
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *`,
            [
              messageId, att.type, att.mediaId || null,
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

      const userRows = await conn.query(
        `SELECT username, display_name, profile_image_url FROM users WHERE user_id = $1`,
        [senderId]
      );
      const userRow = userRows.rows[0] || {};

      return {
        messageId,
        groupId,
        senderId,
        content: content.trim(),
        attachments: savedAttachments.length > 0 ? savedAttachments : undefined,
        createdAt,
        sender: {
          userId: senderId,
          username: userRow.username || `user_${senderId}`,
          displayName: userRow.display_name || `User ${senderId}`,
          profileImageUrl: userRow.profile_image_url || null
        }
      };
    });
  }
}
