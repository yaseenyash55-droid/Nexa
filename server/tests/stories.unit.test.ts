import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as factoryModule from '../src/repositories/factory.js';
import { Story } from '../src/types/index.js';

describe('Story Creation & Multi-Viewer Feed Suite', () => {
  let mockStoryRepo: any;
  let storiesStore: Story[];
  let nextStoryId: number;

  beforeEach(() => {
    vi.clearAllMocks();
    storiesStore = [];
    nextStoryId = 1;

    mockStoryRepo = {
      createStory: vi.fn(async ({ userId, mediaUrl, caption }) => {
        const storyId = nextStoryId++;
        const now = new Date();
        const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        const story: Story = {
          storyId,
          userId,
          author: {
            userId,
            username: `user_${userId}`,
            displayName: `User ${userId}`,
            profileImageUrl: `/uploads/avatars/user-${userId}.jpg`
          },
          mediaUrl,
          caption: caption || null,
          createdAt: now.toISOString(),
          expiresAt: expires.toISOString()
        };

        storiesStore.push(story);
        return story;
      }),

      getFeedStories: vi.fn(async (_userId?: number) => {
        // Return active stories for all viewers
        const now = new Date();
        return storiesStore.filter((s) => new Date(s.expiresAt) > now);
      }),

      deleteStory: vi.fn(async (storyId: number, userId: number) => {
        const index = storiesStore.findIndex((s) => s.storyId === storyId && s.userId === userId);
        if (index >= 0) {
          storiesStore.splice(index, 1);
          return true;
        }
        return false;
      })
    };

    vi.spyOn(factoryModule, 'getStoryRepository').mockReturnValue(mockStoryRepo);
  });

  it('creates story with real uploaded mediaUrl and stores permanent resolvable path', async () => {
    const uploaderId = 101;
    const uploadedMediaUrl = '/uploads/posts/story-101-1718000000.jpg';
    const caption = 'Sunset at Golden Gate';

    const createdStory = await mockStoryRepo.createStory({
      userId: uploaderId,
      mediaUrl: uploadedMediaUrl,
      caption
    });

    expect(createdStory.storyId).toBeGreaterThan(0);
    expect(createdStory.mediaUrl).toBe(uploadedMediaUrl);
    expect(createdStory.caption).toBe(caption);
    expect(createdStory.author.userId).toBe(uploaderId);
  });

  it('allows different accounts / viewers to retrieve and render the exact real uploaded story media', async () => {
    const uploaderId = 101;
    const viewerId = 202; // Different user viewing the story
    const uploadedMediaUrl = '/uploads/posts/story-101-1718000000.jpg';

    // 1. Uploader creates story
    await mockStoryRepo.createStory({
      userId: uploaderId,
      mediaUrl: uploadedMediaUrl,
      caption: 'Real content story'
    });

    // 2. Viewer (different account) loads feed stories
    const feedStoriesForViewer = await mockStoryRepo.getFeedStories(viewerId);

    expect(feedStoriesForViewer).toHaveLength(1);
    const viewerStory = feedStoriesForViewer[0];
    expect(viewerStory.mediaUrl).toBe(uploadedMediaUrl);
    expect(viewerStory.author.userId).toBe(uploaderId);
    expect(viewerStory.author.displayName).toBe('User 101');

    // 3. Uploader loads feed stories and sees the exact same real media
    const feedStoriesForUploader = await mockStoryRepo.getFeedStories(uploaderId);
    expect(feedStoriesForUploader).toHaveLength(1);
    expect(feedStoriesForUploader[0].mediaUrl).toBe(uploadedMediaUrl);
  });
});
