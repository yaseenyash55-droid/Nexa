import { Group, GroupMember, GroupMessage, CreateGroupParams } from '../types/index.js';
import { executeSql, withTransaction } from '../db/pool.js';
import { logger } from '../utils/logger.js';

export interface GroupRepository {
  createGroup(params: CreateGroupParams): Promise<Group>;
  getUserGroups(userId: number): Promise<Group[]>;
  getGroupById(groupId: number): Promise<Group | null>;
  getGroupMembers(groupId: number): Promise<GroupMember[]>;
  addGroupMember(groupId: number, userId: number, role?: 'ADMIN' | 'MEMBER'): Promise<void>;
  getGroupMessages(groupId: number): Promise<GroupMessage[]>;
  sendGroupMessage(groupId: number, senderId: number, content: string): Promise<GroupMessage>;
}

// In-Memory Mock Store for Unit Tests and MOCK Mode
const mockGroups: Group[] = [
  {
    groupId: 1,
    name: 'Nexa Developers',
    description: 'Official development discussion group',
    createdBy: 1,
    avatarUrl: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=150',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    membersCount: 3,
    lastMessage: 'Welcome to Nexa Group Chat!'
  }
];

const mockGroupMembers: GroupMember[] = [
  { groupId: 1, userId: 1, role: 'ADMIN', joinedAt: new Date().toISOString() },
  { groupId: 1, userId: 2, role: 'MEMBER', joinedAt: new Date().toISOString() },
  { groupId: 1, userId: 3, role: 'MEMBER', joinedAt: new Date().toISOString() }
];

const mockGroupMessages: GroupMessage[] = [
  {
    messageId: 1,
    groupId: 1,
    senderId: 1,
    sender: {
      userId: 1,
      username: 'nexa_admin',
      displayName: 'Nexa Admin',
      profileImageUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'
    },
    content: 'Welcome to Nexa Group Chat!',
    createdAt: new Date(Date.now() - 3600000).toISOString()
  }
];

let nextGroupId = 2;
let nextGroupMessageId = 2;

export class MockGroupRepository implements GroupRepository {
  async createGroup(params: CreateGroupParams): Promise<Group> {
    const groupId = nextGroupId++;
    const now = new Date().toISOString();
    const group: Group = {
      groupId,
      name: params.name.trim(),
      description: params.description?.trim() || null,
      createdBy: params.createdBy,
      avatarUrl: params.avatarUrl || null,
      createdAt: now,
      membersCount: 1 + (params.memberIds?.length || 0),
      lastMessage: 'Group created'
    };

    mockGroups.push(group);
    mockGroupMembers.push({ groupId, userId: params.createdBy, role: 'ADMIN', joinedAt: now });

    if (params.memberIds) {
      for (const mId of params.memberIds) {
        if (mId !== params.createdBy) {
          mockGroupMembers.push({ groupId, userId: mId, role: 'MEMBER', joinedAt: now });
        }
      }
    }

    return group;
  }

  async getUserGroups(userId: number): Promise<Group[]> {
    const userGroupIds = new Set(
      mockGroupMembers.filter((gm) => gm.userId === userId).map((gm) => gm.groupId)
    );
    return mockGroups.filter((g) => userGroupIds.has(g.groupId));
  }

  async getGroupById(groupId: number): Promise<Group | null> {
    return mockGroups.find((g) => g.groupId === groupId) || null;
  }

  async getGroupMembers(groupId: number): Promise<GroupMember[]> {
    return mockGroupMembers.filter((gm) => gm.groupId === groupId);
  }

  async addGroupMember(groupId: number, userId: number, role: 'ADMIN' | 'MEMBER' = 'MEMBER'): Promise<void> {
    const exists = mockGroupMembers.some((gm) => gm.groupId === groupId && gm.userId === userId);
    if (!exists) {
      mockGroupMembers.push({ groupId, userId, role, joinedAt: new Date().toISOString() });
      const group = mockGroups.find((g) => g.groupId === groupId);
      if (group) {
        group.membersCount = (group.membersCount || 0) + 1;
      }
    }
  }

  async getGroupMessages(groupId: number): Promise<GroupMessage[]> {
    return mockGroupMessages
      .filter((m) => m.groupId === groupId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  async sendGroupMessage(groupId: number, senderId: number, content: string): Promise<GroupMessage> {
    const msg: GroupMessage = {
      messageId: nextGroupMessageId++,
      groupId,
      senderId,
      sender: {
        userId: senderId,
        username: `user_${senderId}`,
        displayName: `User ${senderId}`,
        profileImageUrl: null
      },
      content: content.trim(),
      createdAt: new Date().toISOString()
    };

    mockGroupMessages.push(msg);
    const group = mockGroups.find((g) => g.groupId === groupId);
    if (group) {
      group.lastMessage = content.trim();
    }
    return msg;
  }
}

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
          { dir: 3003, type: 2002 }, // NUMBER
          { dir: 3003, type: 2007 }  // TIMESTAMP
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
      if (params.memberIds && params.memberIds.length > 0) {
        for (const mId of params.memberIds) {
          if (mId !== params.createdBy) {
            await conn.execute(
              `INSERT INTO GROUP_MEMBERS (GROUP_ID, USER_ID, ROLE, JOINED_AT)
               VALUES (:1, :2, 'MEMBER', SYSTIMESTAMP)`,
              [groupId, mId]
            );
          }
        }
      }

      return {
        groupId,
        name: params.name.trim(),
        description: params.description?.trim() || null,
        createdBy: params.createdBy,
        avatarUrl: params.avatarUrl || null,
        createdAt,
        membersCount: 1 + (params.memberIds?.length || 0),
        lastMessage: null
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
    return rows.map((r: any) => ({
      groupId: r.GROUP_ID,
      name: r.NAME,
      description: r.DESCRIPTION,
      createdBy: r.CREATED_BY,
      avatarUrl: r.AVATAR_URL,
      createdAt: new Date(r.CREATED_AT).toISOString(),
      membersCount: r.MEMBERS_COUNT
    }));
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
    return {
      groupId: r.GROUP_ID,
      name: r.NAME,
      description: r.DESCRIPTION,
      createdBy: r.CREATED_BY,
      avatarUrl: r.AVATAR_URL,
      createdAt: new Date(r.CREATED_AT).toISOString(),
      membersCount: r.MEMBERS_COUNT
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

  async getGroupMessages(groupId: number): Promise<GroupMessage[]> {
    const res = await executeSql(
      `SELECT gm.MESSAGE_ID, gm.GROUP_ID, gm.SENDER_ID, gm.CONTENT, gm.CREATED_AT,
              u.USERNAME, u.DISPLAY_NAME, u.PROFILE_IMAGE_URL
       FROM GROUP_MESSAGES gm
       INNER JOIN USERS u ON gm.SENDER_ID = u.USER_ID
       WHERE gm.GROUP_ID = :1
       ORDER BY gm.CREATED_AT ASC`,
      [groupId]
    );

    const rows = res.rows || [];
    return rows.map((r: any) => ({
      messageId: r.MESSAGE_ID,
      groupId: r.GROUP_ID,
      senderId: r.SENDER_ID,
      content: r.CONTENT,
      createdAt: new Date(r.CREATED_AT).toISOString(),
      sender: {
        userId: r.SENDER_ID,
        username: r.USERNAME,
        displayName: r.DISPLAY_NAME,
        profileImageUrl: r.PROFILE_IMAGE_URL
      }
    }));
  }

  async sendGroupMessage(groupId: number, senderId: number, content: string): Promise<GroupMessage> {
    return withTransaction(async (conn: any) => {
      const result = await conn.execute(
        `INSERT INTO GROUP_MESSAGES (GROUP_ID, SENDER_ID, CONTENT, CREATED_AT)
         VALUES (:1, :2, :3, SYSTIMESTAMP)
         RETURNING MESSAGE_ID, CREATED_AT INTO :4, :5`,
        [
          groupId,
          senderId,
          content.trim(),
          { dir: 3003, type: 2002 }, // NUMBER
          { dir: 3003, type: 2007 }  // TIMESTAMP
        ]
      );

      const messageId = (result.outBinds as any)?.[0]?.[0];
      const createdAt = (result.outBinds as any)?.[1]?.[0]?.toISOString() || new Date().toISOString();

      const userRows = await conn.execute(
        `SELECT USERNAME, DISPLAY_NAME, PROFILE_IMAGE_URL FROM USERS WHERE USER_ID = :1`,
        [senderId]
      );

      const userRow = (userRows.rows as any)?.[0] || {};

      return {
        messageId,
        groupId,
        senderId,
        content: content.trim(),
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
