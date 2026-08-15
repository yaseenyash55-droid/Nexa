import { api } from './client.js';
import { User } from '../types/index.js';

export interface Group {
  groupId: number;
  name: string;
  description?: string | null;
  createdBy: number;
  avatarUrl?: string | null;
  createdAt: string;
  membersCount?: number;
  lastMessage?: string | null;
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
  senderId: number;
  sender: {
    userId: number;
    username: string;
    displayName: string;
    profileImageUrl?: string | null;
  };
  content: string;
  createdAt: string;
}

export const groupsApi = {
  createGroup: async (data: { name: string; description?: string; avatarUrl?: string; memberIds?: number[] }): Promise<Group> => {
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

  sendGroupMessage: async (groupId: number, content: string): Promise<GroupMessage> => {
    const res = await api.post(`/groups/${groupId}/messages`, { content });
    return res.data.data;
  },

  addGroupMembers: async (groupId: number, memberIds: number[]): Promise<GroupMember[]> => {
    const res = await api.post(`/groups/${groupId}/members`, { memberIds });
    return res.data.data;
  }
};
