import { describe, expect, it, vi, beforeEach } from 'vitest';
import { UserService } from '../src/services/user.service.js';
import { User } from '../src/types/index.js';

describe('User Profile & Username Update Suite', () => {
  let mockUserRepo: any;
  let mockNotifRepo: any;
  let userService: UserService;
  let usersStore: Map<number, User>;

  beforeEach(() => {
    vi.clearAllMocks();
    usersStore = new Map();

    // Seed test users
    usersStore.set(1, {
      userId: 1,
      username: 'alice_smith',
      email: 'alice@example.com',
      displayName: 'Alice Smith',
      bio: 'Hello world',
      followersCount: 10,
      followingCount: 5,
      role: 'USER',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    usersStore.set(2, {
      userId: 2,
      username: 'bob_jones',
      email: 'bob@example.com',
      displayName: 'Bob Jones',
      bio: 'Developer',
      followersCount: 3,
      followingCount: 8,
      role: 'USER',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    mockUserRepo = {
      findById: vi.fn(async (id: number) => {
        const u = usersStore.get(id);
        return u ? { ...u } : null;
      }),

      findByUsername: vi.fn(async (uname: string) => {
        for (const u of usersStore.values()) {
          if (u.username.toLowerCase() === uname.toLowerCase()) {
            return { ...u };
          }
        }
        return null;
      }),

      updateUser: vi.fn(async (userId: number, updates: any) => {
        const current = usersStore.get(userId);
        if (!current) throw new Error('User not found');
        const updated = {
          ...current,
          ...updates,
          username: updates.username !== undefined ? updates.username : current.username,
          displayName: updates.displayName !== undefined ? updates.displayName : current.displayName
        };
        usersStore.set(userId, updated);
        return { ...updated };
      })
    };

    mockNotifRepo = {
      createNotification: vi.fn().mockResolvedValue(true)
    };

    userService = new UserService(mockUserRepo, mockNotifRepo);
  });

  it('successfully updates username and display name when valid', async () => {
    const updated = await userService.updateProfile(1, {
      username: 'alice_new_handle',
      displayName: 'Alice Wonderland'
    });

    expect(updated.username).toBe('alice_new_handle');
    expect(updated.displayName).toBe('Alice Wonderland');

    // Verify stored state in repo
    const persisted = await mockUserRepo.findById(1);
    expect(persisted?.username).toBe('alice_new_handle');
    expect(persisted?.displayName).toBe('Alice Wonderland');
  });

  it('rejects duplicate username taken by another user with 409 USERNAME_TAKEN', async () => {
    await expect(
      userService.updateProfile(1, {
        username: 'bob_jones' // already belongs to userId 2
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'USERNAME_TAKEN'
    });
  });

  it('allows user to keep their own current username without triggering conflict', async () => {
    const updated = await userService.updateProfile(1, {
      username: 'alice_smith',
      displayName: 'Alice S.'
    });

    expect(updated.username).toBe('alice_smith');
    expect(updated.displayName).toBe('Alice S.');
  });

  it('rejects invalid username formats (too short, spaces, special symbols)', async () => {
    await expect(
      userService.updateProfile(1, {
        username: 'al' // Too short (< 3)
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_USERNAME'
    });

    await expect(
      userService.updateProfile(1, {
        username: 'alice smith!' // Invalid characters
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_USERNAME'
    });
  });

  it('normalizes uppercase usernames to lowercase when updating profile', async () => {
    const updated = await userService.updateProfile(1, {
      username: 'ALICE_UPDATED'
    });

    expect(updated.username).toBe('alice_updated');
    const persisted = await mockUserRepo.findById(1);
    expect(persisted?.username).toBe('alice_updated');
  });
});
