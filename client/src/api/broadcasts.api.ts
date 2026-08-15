import { api } from './client.js';

export interface Broadcast {
  broadcastId: number;
  senderId: number;
  title?: string | null;
  content: string;
  recipientsCount: number;
  recipientIds: number[];
  createdAt: string;
}

export const broadcastsApi = {
  createBroadcast: async (data: { title?: string; recipientIds: number[]; message: string }): Promise<{ broadcast: Broadcast; messagesCount: number }> => {
    const res = await api.post('/broadcasts', data);
    return res.data.data;
  },

  getUserBroadcasts: async (): Promise<Broadcast[]> => {
    const res = await api.get('/broadcasts');
    return res.data.data;
  }
};
