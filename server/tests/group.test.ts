import { describe, it, expect, beforeEach } from 'vitest';
import { MockGroupRepository } from '../src/repositories/group.repository.js';

describe('Group Chat Repository', () => {
  let groupRepo: MockGroupRepository;

  beforeEach(() => {
    groupRepo = new MockGroupRepository();
  });

  it('should create a new group with creator as ADMIN and members', async () => {
    const group = await groupRepo.createGroup({
      name: 'Frontend Developers',
      description: 'React & Vite channel',
      createdBy: 1,
      memberIds: [2, 3]
    });

    expect(group).toBeDefined();
    expect(group.groupId).toBeGreaterThan(0);
    expect(group.name).toBe('Frontend Developers');
    expect(group.createdBy).toBe(1);

    const members = await groupRepo.getGroupMembers(group.groupId);
    expect(members).toHaveLength(3);
    const admin = members.find((m) => m.userId === 1);
    expect(admin?.role).toBe('ADMIN');
  });

  it('should retrieve user groups for participant', async () => {
    const groupsUser1 = await groupRepo.getUserGroups(1);
    expect(groupsUser1.length).toBeGreaterThan(0);
  });

  it('should send and retrieve group messages', async () => {
    const group = await groupRepo.createGroup({
      name: 'Team Alpha',
      createdBy: 1
    });

    const msg = await groupRepo.sendGroupMessage(group.groupId, 1, 'Hello Team Alpha!');
    expect(msg).toBeDefined();
    expect(msg.content).toBe('Hello Team Alpha!');
    expect(msg.groupId).toBe(group.groupId);

    const messages = await groupRepo.getGroupMessages(group.groupId);
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('Hello Team Alpha!');
  });
});
