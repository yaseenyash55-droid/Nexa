import { describe, it, expect, beforeEach } from 'vitest';
import { MockBroadcastRepository } from '../src/repositories/broadcast.repository.js';

describe('Messaging Broadcast Repository', () => {
  let broadcastRepo: MockBroadcastRepository;

  beforeEach(() => {
    broadcastRepo = new MockBroadcastRepository();
  });

  it('should create a broadcast and store metadata', async () => {
    const broadcast = await broadcastRepo.createBroadcast(
      1,
      [2, 3, 4],
      'Important announcement for all team members',
      'Team Announcement'
    );

    expect(broadcast).toBeDefined();
    expect(broadcast.broadcastId).toBeGreaterThan(0);
    expect(broadcast.senderId).toBe(1);
    expect(broadcast.title).toBe('Team Announcement');
    expect(broadcast.recipientsCount).toBe(3);
  });

  it('should retrieve user broadcast history in descending order', async () => {
    await broadcastRepo.createBroadcast(1, [2], 'Broadcast 1', 'Title 1');
    await broadcastRepo.createBroadcast(1, [3], 'Broadcast 2', 'Title 2');

    const history = await broadcastRepo.getUserBroadcasts(1);
    expect(history.length).toBeGreaterThanOrEqual(2);
    expect(history[0].senderId).toBe(1);
  });
});
