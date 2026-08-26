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

  async getGroupMessages(groupId: number): Promise<GroupMessage[]> {
    const res = await executePostgresSql(
      `SELECT gm.message_id, gm.group_id, gm.sender_id, gm.content, gm.created_at,
              u.username, u.display_name, u.profile_image_url
       FROM group_messages gm
       INNER JOIN users u ON gm.sender_id = u.user_id
       WHERE gm.group_id = $1
       ORDER BY gm.created_at ASC`,
      [groupId]
    );

    return (res.rows || []).map((r: any) => ({
      messageId: Number(r.message_id),
      groupId: Number(r.group_id),
      senderId: Number(r.sender_id),
      content: r.content,
      createdAt: new Date(r.created_at).toISOString(),
      sender: {
        userId: Number(r.sender_id),
        username: r.username,
        displayName: r.display_name,
        profileImageUrl: r.profile_image_url
      }
    }));
  }

  async sendGroupMessage(groupId: number, senderId: number, content: string): Promise<GroupMessage> {
    return withPostgresTransaction(async (conn) => {
      const result = await conn.query(
        `INSERT INTO group_messages (group_id, sender_id, content, created_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         RETURNING message_id, created_at`,
        [groupId, senderId, content.trim()]
      );

      const messageId = Number(result.rows[0].message_id);
      const createdAt = new Date(result.rows[0].created_at).toISOString();

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
