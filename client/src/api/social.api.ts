import { api } from './client.js';
import { Story, Reel, Message, ApiResponse } from '../types/index.js';

export const socialApi = {
  uploadMedia: async (file: File, kind: 'avatar' | 'photo' | 'story' | 'reel' | 'chat'): Promise<{ publicUrl: string }> => {
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);
    const res = await api.post<ApiResponse<{ publicUrl: string }>>('/media/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data.data;
  },

  // Stories API
  getFeedStories: async (): Promise<Story[]> => {
    const res = await api.get<ApiResponse<Story[]>>('/stories/feed');
    return res.data.data;
  },

  createStory: async (data: { mediaUrl: string; caption?: string }): Promise<Story> => {
    const res = await api.post<ApiResponse<Story>>('/stories', data);
    return res.data.data;
  },

  deleteStory: async (storyId: number): Promise<void> => {
    await api.delete(`/stories/${storyId}`);
  },

  // Reels API
  getReels: async (): Promise<Reel[]> => {
    const res = await api.get<ApiResponse<Reel[]>>('/reels');
    return res.data.data;
  },

  createReel: async (data: { videoUrl: string; caption?: string }): Promise<Reel> => {
    const res = await api.post<ApiResponse<Reel>>('/reels', data);
    return res.data.data;
  },

  deleteReel: async (reelId: number): Promise<void> => {
    await api.delete(`/reels/${reelId}`);
  },

  likeReel: async (reelId: number): Promise<void> => {
    await api.post(`/reels/${reelId}/like`);
  },

  unlikeReel: async (reelId: number): Promise<void> => {
    await api.delete(`/reels/${reelId}/like`);
  },

  // Direct Messaging API
  getConversations: async (): Promise<{ userId: number; username: string; displayName: string; profileImageUrl?: string; lastMessage: string; lastMessageAt: string }[]> => {
    const res = await api.get('/messages/conversations');
    return res.data.data;
  },

  getMessagesWithUser: async (otherUserId: number): Promise<Message[]> => {
    const res = await api.get<ApiResponse<Message[]>>(`/messages/${otherUserId}`);
    return res.data.data;
  },

  sendMessage: async (receiverId: number, content: string): Promise<Message> => {
    const res = await api.post<ApiResponse<Message>>('/messages', { receiverId, content });
    return res.data.data;
  },

  markMessageRead: async (messageId: number): Promise<{ rowsAffected: number; read: boolean; readAt: string | null }> => {
    const res = await api.post<ApiResponse<{ rowsAffected: number; read: boolean; readAt: string | null }>>(`/messages/${messageId}/read`);
    return res.data.data;
  }
};
