import oracledb from 'oracledb';
import { Group, GroupMember, GroupMessage, CreateGroupParams } from '../types/index.js';
import { executeSql, withTransaction } from '../db/pool.js';

export interface GroupRepository {
  createGroup(params: CreateGroupParams): Promise<Group>;
  getUserGroups(userId: number): Promise<Group[]>;
  getGroupById(groupId: number): Promise<Group | null>;
  getGroupMembers(groupId: number): Promise<GroupMember[]>;
  addGroupMember(groupId: number, userId: number, role?: 'ADMIN' | 'MEMBER'): Promise<void>;
  removeGroupMember(groupId: number, userId: number): Promise<boolean>;
  getGroupMessages(groupId: number): Promise<GroupMessage[]>;
  sendGroupMessage(groupId: number, senderId: number, content: string, attachments?: any[]): Promise<GroupMessage>;
  sendAiGroupMessage(groupId: number, content: string, aiAgent?: string, triggerMessageId?: number | null): Promise<GroupMessage>;
  findAiGroupResponseByTrigger?(groupId: number, triggerMessageId: number, aiAgent?: string): Promise<GroupMessage | null>;
  updateGroupSettings(groupId: number, settings: { onlyAdminsCanPost?: boolean; name?: string; description?: string }): Promise<void>;
  deleteGroup(groupId: number): Promise<boolean>;
}

// In-memory settings registry for runtime group flags
const groupSettingsMap = new Map<number, { onlyAdminsCanPost?: boolean }>();

export class OracleGroupRepository implements GroupRepository {
  async createGroup(params: CreateGroupParams): Promise<Group> {
    return withTransaction(async (conn: any) => {
      // 1. Insert Group record
      const result = await conn.execute(
        `INSERT INTO GROUPS (NAME, DESCRIPTION, CREATED_BY, AVATAR_URL, CREATED_AT)
         VALUES (:1, :2, :3, :4, SYSTIMESTAMP)
         RETURNING GROUP_ID, CREATED_AT INTO :5, :6`,
        [
          params.name.trim(),
          params.description?.trim() || null,
          params.createdBy,
          params.avatarUrl || null,
          { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
          { dir: oracledb.BIND_OUT, type: oracledb.DATE }
        ]
      );

      const groupId = (result.outBinds as any)?.[0]?.[0];
      const createdAt = (result.outBinds as any)?.[1]?.[0]?.toISOString() || new Date().toISOString();

      // 2. Add creator as ADMIN
      await conn.execute(
        `INSERT INTO GROUP_MEMBERS (GROUP_ID, USER_ID, ROLE, JOINED_AT)
         VALUES (:1, :2, 'ADMIN', SYSTIMESTAMP)`,
        [groupId, params.createdBy]
      );

      // 3. Add members
      const uniqueMemberIds = Array.isArray(params.memberIds)
        ? Array.from(new Set(params.memberIds.map(Number).filter((id) => !isNaN(id) && id > 0 && id !== params.createdBy)))
        : [];

      for (const mId of uniqueMemberIds) {
        await conn.execute(
          `INSERT INTO GROUP_MEMBERS (GROUP_ID, USER_ID, ROLE, JOINED_AT)
           VALUES (:1, :2, 'MEMBER', SYSTIMESTAMP)`,
          [groupId, mId]
        );
      }

      if (params.onlyAdminsCanPost !== undefined) {
        groupSettingsMap.set(groupId, { onlyAdminsCanPost: Boolean(params.onlyAdminsCanPost) });
      }

      return {
        groupId,
        name: params.name.trim(),
        description: params.description?.trim() || null,
        createdBy: params.createdBy,
        avatarUrl: params.avatarUrl || null,
        createdAt,
        membersCount: 1 + uniqueMemberIds.length,
        lastMessage: null,
        onlyAdminsCanPost: params.onlyAdminsCanPost || false
      };
    });
  }

  async getUserGroups(userId: number): Promise<Group[]> {
    const res = await executeSql(
      `SELECT g.GROUP_ID, g.NAME, g.DESCRIPTION, g.CREATED_BY, g.AVATAR_URL, g.CREATED_AT,
              (SELECT COUNT(*) FROM GROUP_MEMBERS gm WHERE gm.GROUP_ID = g.GROUP_ID) as MEMBERS_COUNT
       FROM GROUPS g
       INNER JOIN GROUP_MEMBERS gm ON g.GROUP_ID = gm.GROUP_ID
       WHERE gm.USER_ID = :1
       ORDER BY g.CREATED_AT DESC`,
      [userId]
    );

    const rows = res.rows || [];
    return rows.map((r: any) => {
      const gId = r.GROUP_ID;
      const settings = groupSettingsMap.get(gId);
      return {
        groupId: gId,
        name: r.NAME,
        description: r.DESCRIPTION,
        createdBy: r.CREATED_BY,
        avatarUrl: r.AVATAR_URL,
        createdAt: new Date(r.CREATED_AT).toISOString(),
        membersCount: r.MEMBERS_COUNT,
        onlyAdminsCanPost: settings?.onlyAdminsCanPost || false
      };
    });
  }

  async getGroupById(groupId: number): Promise<Group | null> {
    const res = await executeSql(
      `SELECT GROUP_ID, NAME, DESCRIPTION, CREATED_BY, AVATAR_URL, CREATED_AT,
              (SELECT COUNT(*) FROM GROUP_MEMBERS WHERE GROUP_ID = :1) as MEMBERS_COUNT
       FROM GROUPS
       WHERE GROUP_ID = :1`,
      [groupId]
    );

    const rows = res.rows || [];
    if (rows.length === 0) return null;
    const r = rows[0];
    const settings = groupSettingsMap.get(groupId);
    return {
      groupId: r.GROUP_ID,
      name: r.NAME,
      description: r.DESCRIPTION,
      createdBy: r.CREATED_BY,
      avatarUrl: r.AVATAR_URL,
      createdAt: new Date(r.CREATED_AT).toISOString(),
      membersCount: r.MEMBERS_COUNT,
      onlyAdminsCanPost: settings?.onlyAdminsCanPost || false
    };
  }

  async getGroupMembers(groupId: number): Promise<GroupMember[]> {
    const res = await executeSql(
      `SELECT gm.GROUP_ID, gm.USER_ID, gm.ROLE, gm.JOINED_AT,
              u.USERNAME, u.DISPLAY_NAME, u.PROFILE_IMAGE_URL
       FROM GROUP_MEMBERS gm
       INNER JOIN USERS u ON gm.USER_ID = u.USER_ID
       WHERE gm.GROUP_ID = :1
       ORDER BY gm.JOINED_AT ASC`,
      [groupId]
    );

    const rows = res.rows || [];
    return rows.map((r: any) => ({
      groupId: r.GROUP_ID,
      userId: r.USER_ID,
      role: r.ROLE,
      joinedAt: new Date(r.JOINED_AT).toISOString(),
      user: {
        userId: r.USER_ID,
        username: r.USERNAME,
        displayName: r.DISPLAY_NAME,
        profileImageUrl: r.PROFILE_IMAGE_URL
      }
    }));
  }

  async addGroupMember(groupId: number, userId: number, role: 'ADMIN' | 'MEMBER' = 'MEMBER'): Promise<void> {
    await executeSql(
      `INSERT INTO GROUP_MEMBERS (GROUP_ID, USER_ID, ROLE, JOINED_AT)
       VALUES (:1, :2, :3, SYSTIMESTAMP)`,
      [groupId, userId, role]
    );
  }

  async removeGroupMember(groupId: number, userId: number): Promise<boolean> {
    const res = await executeSql(
      `DELETE FROM GROUP_MEMBERS WHERE GROUP_ID = :1 AND USER_ID = :2`,
      [groupId, userId]
    );
    return Boolean(res.rowsAffected && res.rowsAffected > 0);
  }

  async updateGroupSettings(groupId: number, settings: { onlyAdminsCanPost?: boolean; name?: string; description?: string }): Promise<void> {
    if (settings.onlyAdminsCanPost !== undefined) {
      const current = groupSettingsMap.get(groupId) || {};
      groupSettingsMap.set(groupId, { ...current, onlyAdminsCanPost: settings.onlyAdminsCanPost });
    }
    if (settings.name || settings.description !== undefined) {
      await executeSql(
        `UPDATE GROUPS SET NAME = COALESCE(:1, NAME), DESCRIPTION = COALESCE(:2, DESCRIPTION) WHERE GROUP_ID = :3`,
        [settings.name || null, settings.description || null, groupId]
      );
    }
  }

  async deleteGroup(groupId: number): Promise<boolean> {
    groupSettingsMap.delete(groupId);
    return withTransaction(async (conn: any) => {
      await conn.execute(`DELETE FROM GROUP_MESSAGES WHERE GROUP_ID = :1`, [groupId]);
      await conn.execute(`DELETE FROM GROUP_MEMBERS WHERE GROUP_ID = :1`, [groupId]);
      const res = await conn.execute(`DELETE FROM GROUPS WHERE GROUP_ID = :1`, [groupId]);
      return Boolean(res.rowsAffected && res.rowsAffected > 0);
    });
  }

  async getGroupMessages(groupId: number): Promise<GroupMessage[]> {
    const res = await executeSql(
      `SELECT gm.MESSAGE_ID, gm.GROUP_ID, gm.SENDER_ID, gm.CONTENT, gm.CREATED_AT, gm.SENDER_TYPE, gm.AI_AGENT, gm.TRIGGER_MESSAGE_ID,
              u.USERNAME, u.DISPLAY_NAME, u.PROFILE_IMAGE_URL
       FROM GROUP_MESSAGES gm
       LEFT JOIN USERS u ON gm.SENDER_ID = u.USER_ID
       WHERE gm.GROUP_ID = :1
       ORDER BY gm.CREATED_AT ASC`,
      [groupId]
    );

    const rows = res.rows || [];
    const messages: GroupMessage[] = rows.map((r: any) => {
      const isAi = (r.SENDER_TYPE || '').toLowerCase() === 'ai' || r.SENDER_ID === null;
      return {
        messageId: r.MESSAGE_ID,
        groupId: r.GROUP_ID,
        senderId: isAi ? null : r.SENDER_ID,
        senderType: isAi ? 'ai' : 'user',
        aiAgent: isAi ? (r.AI_AGENT || 'nexa') : undefined,
        triggerMessageId: r.TRIGGER_MESSAGE_ID ?? null,
        content: r.CONTENT,
        attachments: undefined,
        createdAt: new Date(r.CREATED_AT).toISOString(),
        sender: {
          userId: isAi ? 0 : Number(r.SENDER_ID),
          username: isAi ? 'nexa' : (r.USERNAME || 'user'),
          displayName: isAi ? 'NEXA AI' : (r.DISPLAY_NAME || 'User'),
          profileImageUrl: isAi ? '/nexa-ai-avatar.png' : (r.PROFILE_IMAGE_URL || null)
        }
      };
    });

    if (messages.length > 0) {
      const msgIds = messages.map((m) => m.messageId);
      const msgIdsList = msgIds.join(',');
      if (msgIdsList) {
        const attRes = await executeSql(
          `SELECT MESSAGE_ID, ATTACHMENT_TYPE, MEDIA_ID,
                  MUSIC_PROVIDER, MUSIC_TRACK_ID, MUSIC_TITLE,
                  MUSIC_ARTIST, MUSIC_ARTWORK_URL, MUSIC_AUDIO_URL, MUSIC_DURATION
           FROM MESSAGE_ATTACHMENTS
           WHERE GROUP_MESSAGE_ID IN (${msgIdsList})`
        );
        const attachmentsByMsgId: Record<number, any[]> = {};
        for (const row of (attRes.rows || [])) {
          const mId = Number(row.MESSAGE_ID);
          if (!attachmentsByMsgId[mId]) {
            attachmentsByMsgId[mId] = [];
          }
          attachmentsByMsgId[mId].push({
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
        for (const m of messages) {
          if (attachmentsByMsgId[m.messageId]) {
            m.attachments = attachmentsByMsgId[m.messageId];
          }
        }
      }
    }

    return messages;
  }

  async findAiGroupResponseByTrigger(groupId: number, triggerMessageId: number, aiAgent = 'nexa'): Promise<GroupMessage | null> {
    const res = await executeSql(
      `SELECT gm.MESSAGE_ID, gm.GROUP_ID, gm.SENDER_ID, gm.CONTENT, gm.CREATED_AT, gm.SENDER_TYPE, gm.AI_AGENT, gm.TRIGGER_MESSAGE_ID,
              u.USERNAME, u.DISPLAY_NAME, u.PROFILE_IMAGE_URL
       FROM GROUP_MESSAGES gm
       LEFT JOIN USERS u ON gm.SENDER_ID = u.USER_ID
       WHERE gm.GROUP_ID = :1
         AND gm.TRIGGER_MESSAGE_ID = :2
         AND gm.SENDER_TYPE = 'ai'
         AND gm.AI_AGENT = :3
       FETCH FIRST 1 ROWS ONLY`,
      [groupId, triggerMessageId, aiAgent]
    );

    const row = (res.rows || [])[0] as any;
    if (!row) return null;

    return {
      messageId: row.MESSAGE_ID,
      groupId: row.GROUP_ID,
      senderId: null,
      senderType: 'ai',
      aiAgent,
      triggerMessageId: row.TRIGGER_MESSAGE_ID ?? null,
      content: row.CONTENT,
      createdAt: new Date(row.CREATED_AT).toISOString(),
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

    // 1. Durable idempotency pre-check
    if (triggerMessageId) {
      const existing = await this.findAiGroupResponseByTrigger(groupId, triggerMessageId, agentName);
      if (existing) {
        return existing;
      }
    }

    try {
      return await withTransaction(async (conn: any) => {
        const result = await conn.execute(
          `INSERT INTO GROUP_MESSAGES (GROUP_ID, SENDER_ID, CONTENT, SENDER_TYPE, AI_AGENT, TRIGGER_MESSAGE_ID, CREATED_AT)
           VALUES (:1, NULL, :2, 'ai', :3, :4, SYSTIMESTAMP)
           RETURNING MESSAGE_ID, CREATED_AT INTO :5, :6`,
          [
            groupId,
            content.trim(),
            agentName,
            triggerMessageId ?? null,
            { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
            { dir: oracledb.BIND_OUT, type: oracledb.DATE }
          ]
        );

        const messageId = (result.outBinds as any)?.[0]?.[0];
        const createdAt = (result.outBinds as any)?.[1]?.[0]?.toISOString() || new Date().toISOString();

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
    } catch (err: any) {
      // ORA-00001: unique constraint violated
      if (err?.errorNum === 1 || err?.message?.includes('ORA-00001') || err?.code === 'ORA-00001') {
        if (triggerMessageId) {
          const existing = await this.findAiGroupResponseByTrigger(groupId, triggerMessageId, agentName);
          if (existing) return existing;
        }
      }
      throw err;
    }
  }

  async sendGroupMessage(groupId: number, senderId: number, content: string, attachments?: any[]): Promise<GroupMessage> {
    return withTransaction(async (conn: any) => {
      const result = await conn.execute(
        `INSERT INTO GROUP_MESSAGES (GROUP_ID, SENDER_ID, CONTENT, CREATED_AT)
         VALUES (:1, :2, :3, SYSTIMESTAMP)
         RETURNING MESSAGE_ID, CREATED_AT INTO :4, :5`,
        [
          groupId,
          senderId,
          content.trim(),
          { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
          { dir: oracledb.BIND_OUT, type: oracledb.DATE }
        ]
      );

      const messageId = (result.outBinds as any)?.[0]?.[0];
      const createdAt = (result.outBinds as any)?.[1]?.[0]?.toISOString() || new Date().toISOString();

      const savedAttachments = [];
      if (attachments && attachments.length > 0) {
        for (const att of attachments) {
          const attSql = `
            INSERT INTO MESSAGE_ATTACHMENTS (
              GROUP_MESSAGE_ID, ATTACHMENT_TYPE, MEDIA_ID,
              MUSIC_PROVIDER, MUSIC_TRACK_ID, MUSIC_TITLE,
              MUSIC_ARTIST, MUSIC_ARTWORK_URL, MUSIC_AUDIO_URL, MUSIC_DURATION
            ) VALUES (
              :messageId, :attachmentType, :mediaId,
              :musicProvider, :musicTrackId, :musicTitle,
              :musicArtist, :musicArtworkUrl, :musicAudioUrl, :musicDuration
            )
            RETURNING ATTACHMENT_ID INTO :attachmentId
          `;
          const attBinds = {
            messageId,
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

      const userRows = await conn.execute(`SELECT USERNAME, DISPLAY_NAME, PROFILE_IMAGE_URL FROM USERS WHERE USER_ID = :1`, [senderId]);

      const userRow = (userRows.rows as any)?.[0] || {};

      return {
        messageId,
        groupId,
        senderId,
        content: content.trim(),
        attachments: savedAttachments.length > 0 ? savedAttachments : undefined,
        createdAt,
        sender: {
          userId: senderId,
          username: userRow.USERNAME || `user_${senderId}`,
          displayName: userRow.DISPLAY_NAME || `User ${senderId}`,
          profileImageUrl: userRow.PROFILE_IMAGE_URL || null
        }
      };
    });
  }
}
