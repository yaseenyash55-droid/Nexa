import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createGroup, getUserGroups, getGroupMessages, sendGroupMessage, addGroupMembers } from '../src/controllers/group.controller.js';
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
          lastMessage: null
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
});
