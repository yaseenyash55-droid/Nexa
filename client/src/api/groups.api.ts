import { api } from './client.js';
import { User, ApiResponse, ReactionSummary } from '../types/index.js';

export interface Group {
  groupId: number;
  name: string;
  description?: string | null;
  createdBy: number;
  avatarUrl?: string | null;
  createdAt: string;
  membersCount?: number;
  lastMessage?: string | null;
  onlyAdminsCanPost?: boolean;
}

export interface GroupMember {
  groupId: number;
  userId: number;
  role: 'ADMIN' | 'MEMBER';
  joinedAt: string;
  user?: User;
}

export interface GroupMessage {
  messageId: number;
  groupId: number;
  senderId?: number | null;
  sender: {
    userId: number;
    username: string;
    displayName: string;
    profileImageUrl?: string | null;
  };
  content: string;
  senderType?: 'user' | 'ai';
  aiAgent?: string;
  isUnsent?: boolean;
  editedAt?: string | null;
  replyToMessageId?: number | null;
  replyPreview?: { senderId?: number | null; senderName: string; content: string } | null;
  reactions?: ReactionSummary[];
  attachments?: any[];
  createdAt: string;
}

export const groupsApi = {
  createGroup: async (data: { name: string; description?: string; avatarUrl?: string; memberIds?: number[]; onlyAdminsCanPost?: boolean }): Promise<Group> => {
    const res = await api.post('/groups', data);
    return res.data.data;
  },

  getUserGroups: async (): Promise<Group[]> => {
    const res = await api.get('/groups');
    return res.data.data;
  },

  getGroupMessages: async (groupId: number): Promise<GroupMessage[]> => {
    const res = await api.get(`/groups/${groupId}/messages`);
    return res.data.data;
  },

  sendGroupMessage: async (groupId: number, content?: string, attachments?: any[], replyToMessageId?: number | null): Promise<GroupMessage> => {
    const res = await api.post<ApiResponse<GroupMessage>>(`/groups/${groupId}/messages`, { content, attachments, replyToMessageId });
    return res.data.data;
  },

  unsendGroupMessage: async (groupId: number, messageId: number): Promise<{ success: boolean; messageId: number }> => {
    const res = await api.delete(`/groups/${groupId}/messages/${messageId}`);
    return res.data.data;
  },

  editGroupMessage: async (groupId: number, messageId: number, content: string): Promise<{ success: boolean; messageId: number; editedAt: string }> => {
    const res = await api.patch(`/groups/${groupId}/messages/${messageId}`, { content });
    return res.data.data;
  },

  addGroupReaction: async (groupId: number, messageId: number, reaction: string): Promise<{ success: boolean; reactions: ReactionSummary[] }> => {
    const res = await api.put(`/groups/${groupId}/messages/${messageId}/reaction`, { reaction });
    return res.data.data;
  },

  removeGroupReaction: async (groupId: number, messageId: number): Promise<{ success: boolean; reactions: ReactionSummary[] }> => {
    const res = await api.delete(`/groups/${groupId}/messages/${messageId}/reaction`);
    return res.data.data;
  },

  addGroupMembers: async (groupId: number, memberIds: number[]): Promise<GroupMember[]> => {
    const res = await api.post(`/groups/${groupId}/members`, { memberIds });
    return res.data.data;
  },

  getGroupById: async (groupId: number): Promise<Group> => {
    const res = await api.get(`/groups/${groupId}`);
    return res.data.data;
  },

  getGroupMembers: async (groupId: number): Promise<GroupMember[]> => {
    const res = await api.get(`/groups/${groupId}/members`);
    return res.data.data;
  },

  removeGroupMember: async (groupId: number, userId: number): Promise<{ success: boolean; isSelf: boolean; removedUserId: number }> => {
    const res = await api.delete(`/groups/${groupId}/members/${userId}`);
    return res.data.data;
  },

  leaveGroup: async (groupId: number): Promise<{ success: boolean }> => {
    const res = await api.post(`/groups/${groupId}/leave`);
    return res.data.data;
  },

  updateGroupSettings: async (groupId: number, settings: { onlyAdminsCanPost?: boolean; name?: string; description?: string }): Promise<Group> => {
    const res = await api.patch(`/groups/${groupId}/settings`, settings);
    return res.data.data;
  },

  deleteGroup: async (groupId: number): Promise<{ success: boolean; deletedGroupId: number }> => {
    const res = await api.delete(`/groups/${groupId}`);
    return res.data.data;
  }
};
