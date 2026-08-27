import { Post, Reel } from '../types/index.js';

export const MOCK_POSTS: Post[] = [
  {
    postId: 9991,
    userId: 9999,
    content: "Exploring the beautiful volcanic ridges in Iceland! Nature is absolutely breathtaking. #explore #iceland #nature",
    imageUrl: "https://images.unsplash.com/photo-1504893524553-ac55fce698be?auto=format&fit=crop&w=600&q=80",
    likesCount: 1250,
    commentsCount: 89,
    isLiked: false,
    isBookmarked: false,
    isMock: true, // Special flag to identify mock content
    author: {
      userId: 9999,
      username: "nature_seeker",
      email: null,
      displayName: "Nature Seeker",
      bio: "Adventurer & Photographer",
      profileImageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
    } as any,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    postId: 9992,
    userId: 9998,
    content: "Just baked a fresh batch of sourdough bread! Nothing beats the smell of warm bread in the morning. 🍞✨ #baking #sourdough #foodie",
    imageUrl: "https://images.unsplash.com/photo-1549931319-a545dcf3bc73?auto=format&fit=crop&w=600&q=80",
    likesCount: 842,
    commentsCount: 34,
    isLiked: false,
    isBookmarked: false,
    isMock: true,
    author: {
      userId: 9998,
      username: "chef_bakery",
      email: null,
      displayName: "Chef Bakery",
      bio: "Sourdough enthusiast & pastry chef",
      profileImageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80"
    } as any,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const MOCK_REELS: Reel[] = [
  {
    reelId: 9995,
    userId: 9997,
    videoUrl: "https://www.w3schools.com/html/mov_bbb.mp4",
    caption: "Chasing sunsets along the Amalfi Coast! 🌅🇮🇹 #travel #reels #sunset",
    likesCount: 3500,
    isLiked: false,
    isMock: true,
    author: {
      userId: 9997,
      username: "wanderlust_travels",
      email: null,
      displayName: "Wanderlust Travels",
      bio: "Traveling the world one sunset at a time",
      profileImageUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80"
    } as any,
    createdAt: new Date().toISOString()
  }
];

export class MockExploreService {
  public static getExploreContent(): { posts: Post[]; reels: Reel[] } {
    const isMockEnabled = process.env.SHOW_MOCK_EXPLORE_CONTENT === 'true';
    if (!isMockEnabled) {
      return { posts: [], reels: [] };
    }
    return {
      posts: MOCK_POSTS,
      reels: MOCK_REELS
    };
  }
}
