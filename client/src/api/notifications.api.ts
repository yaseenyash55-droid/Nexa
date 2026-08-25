import { api } from './client.js';
import { Notification, ApiResponse } from '../types/index.js';

export const notificationsApi = {
  async getNotifications(cursor?: number): Promise<ApiResponse<Notification[]>> {
    const res = await api.get<ApiResponse<Notification[]>>('/notifications', { params: { cursor } });
    return res.data;
  },

  async markAsRead(id: number): Promise<void> {
    await api.patch(`/notifications/${id}/read`);
  },

  async markAllAsRead(): Promise<void> {
    await api.patch('/notifications/read-all');
  },

  async registerFcmToken(fcmToken: string, platform = 'web', deviceId?: string): Promise<void> {
    await api.post('/notifications/fcm-token', { fcmToken, platform, deviceId });
  },

  async revokeFcmToken(fcmToken?: string): Promise<void> {
    await api.post('/notifications/fcm-token/revoke', { fcmToken });
  }
};
