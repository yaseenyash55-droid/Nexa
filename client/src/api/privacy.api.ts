import { api } from './client.js';

export interface PrivacySettingsPayload {
  isPrivate?: boolean;
  whoCanMessage?: 'EVERYONE' | 'FOLLOWERS' | 'NO_ONE';
  whoCanComment?: 'EVERYONE' | 'FOLLOWERS' | 'NO_ONE';
  activityStatusVisible?: boolean;
  readReceiptsEnabled?: boolean;
  hideLikeCounts?: boolean;
}

export interface ReportPayload {
  targetType: 'user' | 'post' | 'story' | 'reel' | 'comment';
  targetId: number;
  reason: string;
  details?: string;
}

export interface ModerationReport {
  reportId: number;
  reporterUserId: number;
  reporterUsername: string;
  targetType: string;
  targetId: number;
  reason: string;
  details?: string;
  status: 'PENDING' | 'RESOLVED' | 'DISMISSED';
  createdAt: string;
}

export const privacyApi = {
  getPrivacySettings: async () => {
    const res = await api.get('/privacy/settings');
    return res.data;
  },

  updatePrivacySettings: async (settings: PrivacySettingsPayload) => {
    const res = await api.put('/privacy/settings', settings);
    return res.data;
  },

  getHiddenWords: async () => {
    const res = await api.get('/privacy/hidden-words');
    return res.data;
  },

  updateHiddenWords: async (words: string[]) => {
    const res = await api.put('/privacy/hidden-words', { words });
    return res.data;
  },

  submitReport: async (payload: ReportPayload) => {
    const res = await api.post('/privacy/reports', payload);
    return res.data;
  },

  getModerationReports: async (status?: string): Promise<{ success: boolean; data: ModerationReport[] }> => {
    const res = await api.get('/privacy/reports', { params: status ? { status } : {} });
    return res.data;
  },

  actionModerationReport: async (reportId: number, action: 'DISMISS' | 'REMOVE_CONTENT' | 'WARN_USER' | 'BAN_USER', notes?: string) => {
    const res = await api.post(`/privacy/reports/${reportId}/action`, { action, notes });
    return res.data;
  },

  getBlockedUsers: async () => {
    const res = await api.get('/privacy/blocks');
    return res.data;
  },

  blockUser: async (blockedUserId: number) => {
    const res = await api.post('/privacy/blocks', { blockedUserId });
    return res.data;
  },

  unblockUser: async (blockedUserId: number) => {
    const res = await api.delete(`/privacy/blocks/${blockedUserId}`);
    return res.data;
  },

  getFollowRequests: async () => {
    const res = await api.get('/privacy/follow-requests');
    return res.data;
  },

  respondFollowRequest: async (requestId: number, action: 'ACCEPT' | 'REJECT') => {
    const res = await api.post(`/privacy/follow-requests/${requestId}/respond`, { action });
    return res.data;
  }
};
