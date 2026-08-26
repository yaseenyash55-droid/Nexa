import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  createGroup,
  getUserGroups,
  getGroupById,
  getGroupMembers,
  getGroupMessages,
  sendGroupMessage,
  addGroupMembers,
  removeGroupMember,
  leaveGroup,
  updateGroupSettings,
  deleteGroup
} from '../src/controllers/group.controller.js';
import * as factoryModule from '../src/repositories/factory.js';
import { Group, GroupMember } from '../src/types/index.js';

describe('Group Chat Flow & Multi-Member Creation Suite', () => {
  let mockGroupRepo: any;
  let groupsStore: Map<number, Group>;
  let membersStore: Map<number, GroupMember[]>;
  let nextGroupId: number;

  beforeEach(() => {
    vi.clearAllMocks();
    groupsStore = new Map();
    membersStore = new Map();
    nextGroupId = 1;

    mockGroupRepo = {
      createGroup: vi.fn(async ({ name, description, avatarUrl, createdBy, memberIds }) => {
        const groupId = nextGroupId++;
        const createdAt = new Date().toISOString();
        const uniqueMemberIds = Array.isArray(memberIds)
          ? Array.from(new Set(memberIds.map(Number).filter((id: number) => !isNaN(id) && id > 0 && id !== createdBy)))
          : [];

        const group: Group = {
          groupId,
          name,
          description: description || null,
          createdBy,
          avatarUrl: avatarUrl || null,
          createdAt,
          membersCount: 1 + uniqueMemberIds.length,
          lastMessage: null,
          onlyAdminsCanPost: false
        };
        groupsStore.set(groupId, group);

        // Store creator as ADMIN
        const members: GroupMember[] = [
          {
            groupId,
            userId: createdBy,
            role: 'ADMIN',
            joinedAt: createdAt,
            user: {
              userId: createdBy,
              username: `user_${createdBy}`,
              displayName: `User ${createdBy}`,
              profileImageUrl: null
            }
          }
        ];

        // Store other members
        for (const mId of uniqueMemberIds) {
          members.push({
            groupId,
            userId: mId,
            role: 'MEMBER',
            joinedAt: createdAt,
            user: {
              userId: mId,
              username: `user_${mId}`,
              displayName: `User ${mId}`,
              profileImageUrl: null
            }
          });
        }

        membersStore.set(groupId, members);
        return group;
      }),

      getGroupMembers: vi.fn(async (groupId: number) => {
        return membersStore.get(groupId) || [];
      }),

      getGroupById: vi.fn(async (groupId: number) => {
        return groupsStore.get(groupId) || null;
      }),

      getUserGroups: vi.fn(async (userId: number) => {
        const userGroups: Group[] = [];
        for (const [gId, members] of membersStore.entries()) {
          if (members.some((m) => m.userId === userId)) {
            const g = groupsStore.get(gId);
            if (g) userGroups.push(g);
          }
        }
        return userGroups;
      }),

      addGroupMember: vi.fn(async (groupId: number, userId: number, role: 'ADMIN' | 'MEMBER' = 'MEMBER') => {
        const members = membersStore.get(groupId) || [];
        if (!members.some((m) => m.userId === userId)) {
          members.push({
            groupId,
            userId,
            role,
            joinedAt: new Date().toISOString(),
            user: {
              userId,
              username: `user_${userId}`,
              displayName: `User ${userId}`,
              profileImageUrl: null
            }
          });
          membersStore.set(groupId, members);
        }
      }),

      removeGroupMember: vi.fn(async (groupId: number, userId: number) => {
        const members = membersStore.get(groupId) || [];
        const filtered = members.filter((m) => m.userId !== userId);
        membersStore.set(groupId, filtered);
      }),

      updateGroupSettings: vi.fn(async (groupId: number, settings: { onlyAdminsCanPost?: boolean }) => {
        const group = groupsStore.get(groupId);
        if (!group) throw new Error('Group not found');
        if (settings.onlyAdminsCanPost !== undefined) {
          group.onlyAdminsCanPost = settings.onlyAdminsCanPost;
        }
        groupsStore.set(groupId, group);
        return group;
      }),

      deleteGroup: vi.fn(async (groupId: number) => {
        groupsStore.delete(groupId);
        membersStore.delete(groupId);
      }),

      sendGroupMessage: vi.fn(async (groupId: number, senderId: number, content: string) => {
        return {
          messageId: 999,
          groupId,
          senderId,
          content,
          createdAt: new Date().toISOString(),
          sender: {
            userId: senderId,
            username: `user_${senderId}`,
            displayName: `User ${senderId}`,
            profileImageUrl: null
          }
        };
      })
    };

    vi.spyOn(factoryModule, 'getGroupRepository').mockReturnValue(mockGroupRepo);
  });

  it('creates a group with 2+ members and verifies all appear in the member list', async () => {
    const creatorId = 100;
    const memberIds = [201, 202, 203];

    const req: any = {
      user: { userId: creatorId, username: 'alice', email: 'alice@nexa.app' },
      body: {
        name: 'Design & Engineering Core',
        description: 'Cross-functional chat',
        memberIds
      }
    };

    let responseStatus: number = 200;
    let responseData: any = null;

    const res: any = {
      status: (code: number) => {
        responseStatus = code;
        return res;
      },
      json: (data: any) => {
        responseData = data;
        return res;
      }
    };

    await createGroup(req, res);

    expect(responseStatus).toBe(201);
    expect(responseData).not.toBeNull();
    expect(responseData.data.groupId).toBeGreaterThan(0);
    expect(responseData.data.name).toBe('Design & Engineering Core');
    expect(responseData.data.membersCount).toBe(4); // Creator + 3 members

    // Verify member list retrieval
    const members = await mockGroupRepo.getGroupMembers(responseData.data.groupId);
    expect(members).toHaveLength(4);

    const memberUserIds = members.map((m: GroupMember) => m.userId);
    expect(memberUserIds).toContain(creatorId);
    expect(memberUserIds).toContain(201);
    expect(memberUserIds).toContain(202);
    expect(memberUserIds).toContain(203);

    // Creator should be ADMIN
    const creator = members.find((m: GroupMember) => m.userId === creatorId);
    expect(creator?.role).toBe('ADMIN');

    // Other members should be MEMBER
    const member201 = members.find((m: GroupMember) => m.userId === 201);
    expect(member201?.role).toBe('MEMBER');
  });

  it('correctly handles duplicates, strings, and creator ID in memberIds payload', async () => {
    const creatorId = 50;
    const req: any = {
      user: { userId: creatorId, username: 'creator', email: 'creator@nexa.app' },
      body: {
        name: 'Normalization Test Group',
        memberIds: ['101', 102, '101', creatorId, 'invalid', -5]
      }
    };

    let responseStatus: number = 200;
    let responseData: any = null;
    const res: any = {
      status: (code: number) => {
        responseStatus = code;
        return res;
      },
      json: (data: any) => {
        responseData = data;
        return res;
      }
    };

    await createGroup(req, res);

    expect(responseStatus).toBe(201);
    expect(responseData.data.membersCount).toBe(3); // Creator (50) + 101 + 102

    const members = await mockGroupRepo.getGroupMembers(responseData.data.groupId);
    const memberUserIds = members.map((m: GroupMember) => m.userId);
    expect(memberUserIds).toEqual([50, 101, 102]);
  });

  it('rejects group creation if group name is missing or whitespace', async () => {
    const req: any = {
      user: { userId: 1, username: 'test' },
      body: {
        name: '   ',
        memberIds: [2, 3]
      }
    };

    let responseStatus: number = 200;
    let responseData: any = null;
    const res: any = {
      status: (code: number) => {
        responseStatus = code;
        return res;
      },
      json: (data: any) => {
        responseData = data;
        return res;
      }
    };

    await createGroup(req, res);
    expect(responseStatus).toBe(400);
    expect(responseData.error.code).toBe('VALIDATION_ERROR');
  });

  it('fetches group details and member list via getGroupById and getGroupMembers', async () => {
    // 1. Create a group first
    const createReq: any = {
      user: { userId: 10, username: 'admin_user' },
      body: {
        name: 'Backend Devs',
        description: 'Internal API channel',
        memberIds: [20, 30]
      }
    };

    let createdData: any = null;
    const createRes: any = {
      status: () => createRes,
      json: (data: any) => {
        createdData = data;
        return createRes;
      }
    };
    await createGroup(createReq, createRes);
    const groupId = createdData.data.groupId;

    // 2. Fetch group by ID
    const getGroupReq: any = {
      user: { userId: 10 },
      params: { id: String(groupId) }
    };
    let groupResult: any = null;
    const getGroupRes: any = {
      json: (data: any) => {
        groupResult = data;
        return getGroupRes;
      }
    };
    await getGroupById(getGroupReq, getGroupRes);
    expect(groupResult.data.name).toBe('Backend Devs');
    expect(groupResult.data.membersCount).toBe(3);

    // 3. Fetch group members
    const getMembersReq: any = {
      user: { userId: 10 },
      params: { id: String(groupId) }
    };
    let membersResult: any = null;
    const getMembersRes: any = {
      json: (data: any) => {
        membersResult = data;
        return getMembersRes;
      }
    };
    await getGroupMembers(getMembersReq, getMembersRes);
    expect(membersResult.data).toHaveLength(3);
    const ids = membersResult.data.map((m: any) => m.userId);
    expect(ids).toEqual([10, 20, 30]);
  });

  it('allows admin to add new members and evict existing members', async () => {
    // 1. Create group with creator 100 and member 200
    const createReq: any = {
      user: { userId: 100 },
      body: { name: 'Alpha Squad', memberIds: [200] }
    };
    let created: any = null;
    const createRes: any = { status: () => createRes, json: (d: any) => { created = d; return createRes; } };
    await createGroup(createReq, createRes);
    const groupId = created.data.groupId;

    // 2. Add member 300
    const addReq: any = {
      user: { userId: 100 },
      params: { id: String(groupId) },
      body: { members: [300] }
    };
    let addResult: any = null;
    const addRes: any = { status: () => addRes, json: (d: any) => { addResult = d; return addRes; } };
    await addGroupMembers(addReq, addRes);
    expect(Array.isArray(addResult.data)).toBe(true);

    let members = await mockGroupRepo.getGroupMembers(groupId);
    expect(members.map((m: any) => m.userId)).toContain(300);

    // 3. Non-admin (200) attempts to remove member 300 -> rejected 403
    const nonAdminRemoveReq: any = {
      user: { userId: 200 },
      params: { id: String(groupId), userId: '300' }
    };
    let nonAdminStatus = 200;
    const nonAdminRemoveRes: any = {
      status: (code: number) => { nonAdminStatus = code; return nonAdminRemoveRes; },
      json: () => nonAdminRemoveRes
    };
    await removeGroupMember(nonAdminRemoveReq, nonAdminRemoveRes);
    expect(nonAdminStatus).toBe(403);

    // 4. Admin (100) removes member 300 -> successful
    const adminRemoveReq: any = {
      user: { userId: 100 },
      params: { id: String(groupId), userId: '300' }
    };
    let adminRemoveStatus = 200;
    let adminRemoveResult: any = null;
    const adminRemoveRes: any = {
      status: (code: number) => { adminRemoveStatus = code; return adminRemoveRes; },
      json: (d: any) => { adminRemoveResult = d; return adminRemoveRes; }
    };
    await removeGroupMember(adminRemoveReq, adminRemoveRes);
    expect(adminRemoveStatus).toBe(200);
    expect(adminRemoveResult.data.success).toBe(true);

    members = await mockGroupRepo.getGroupMembers(groupId);
    expect(members.map((m: any) => m.userId)).not.toContain(300);
  });

  it('enforces announcement mode (onlyAdminsCanPost) on message sending', async () => {
    // 1. Create group with creator 100 (admin) and member 200
    const createReq: any = {
      user: { userId: 100 },
      body: { name: 'Broadcast Group', memberIds: [200] }
    };
    let created: any = null;
    const createRes: any = { status: () => createRes, json: (d: any) => { created = d; return createRes; } };
    await createGroup(createReq, createRes);
    const groupId = created.data.groupId;

    // 2. Admin enables announcement mode (onlyAdminsCanPost = true)
    const settingsReq: any = {
      user: { userId: 100 },
      params: { id: String(groupId) },
      body: { onlyAdminsCanPost: true }
    };
    let settingsResult: any = null;
    const settingsRes: any = { status: () => settingsRes, json: (d: any) => { settingsResult = d; return settingsRes; } };
    await updateGroupSettings(settingsReq, settingsRes);
    expect(settingsResult.data.onlyAdminsCanPost).toBe(true);

    // 3. Regular member (200) tries to send a message -> rejected with 403
    const memberMsgReq: any = {
      user: { userId: 200 },
      params: { id: String(groupId) },
      body: { content: 'Hello everyone!' }
    };
    let memberMsgStatus = 200;
    let memberMsgResult: any = null;
    const memberMsgRes: any = {
      status: (code: number) => { memberMsgStatus = code; return memberMsgRes; },
      json: (d: any) => { memberMsgResult = d; return memberMsgRes; }
    };
    await sendGroupMessage(memberMsgReq, memberMsgRes);
    expect(memberMsgStatus).toBe(403);
    expect(memberMsgResult.error.message).toMatch(/Only admins can post in this group/);

    // 4. Admin (100) sends a message -> successful
    const adminMsgReq: any = {
      user: { userId: 100 },
      params: { id: String(groupId) },
      body: { content: 'Official Announcement' }
    };
    let adminMsgStatus = 200;
    let adminMsgResult: any = null;
    const adminMsgRes: any = {
      status: (code: number) => { adminMsgStatus = code; return adminMsgRes; },
      json: (d: any) => { adminMsgResult = d; return adminMsgRes; }
    };
    await sendGroupMessage(adminMsgReq, adminMsgRes);
    expect(adminMsgStatus).toBe(201);
    expect(adminMsgResult.data.content).toBe('Official Announcement');
  });

  it('allows member to self-leave and admin to delete the group', async () => {
    // 1. Create group with creator 100 and member 200
    const createReq: any = {
      user: { userId: 100 },
      body: { name: 'Project Phoenix', memberIds: [200] }
    };
    let created: any = null;
    const createRes: any = { status: () => createRes, json: (d: any) => { created = d; return createRes; } };
    await createGroup(createReq, createRes);
    const groupId = created.data.groupId;

    // 2. Member 200 leaves group
    const leaveReq: any = {
      user: { userId: 200 },
      params: { id: String(groupId) }
    };
    let leaveResult: any = null;
    const leaveRes: any = { status: () => leaveRes, json: (d: any) => { leaveResult = d; return leaveRes; } };
    await leaveGroup(leaveReq, leaveRes);
    expect(leaveResult.data.success).toBe(true);

    let members = await mockGroupRepo.getGroupMembers(groupId);
    expect(members.map((m: any) => m.userId)).toEqual([100]);

    // 3. Admin deletes group
    const deleteReq: any = {
      user: { userId: 100 },
      params: { id: String(groupId) }
    };
    let deleteResult: any = null;
    const deleteRes: any = { status: () => deleteRes, json: (d: any) => { deleteResult = d; return deleteRes; } };
    await deleteGroup(deleteReq, deleteRes);
    expect(deleteResult.data.success).toBe(true);

    const groupAfterDelete = await mockGroupRepo.getGroupById(groupId);
    expect(groupAfterDelete).toBeNull();
  });
});
