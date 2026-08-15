import { api } from './client.js';
import { User, ApiResponse } from '../types/index.js';

export const usersApi = {
  async getByUsername(username: string): Promise<User> {
    const res = await api.get<ApiResponse<User>>(`/users/username/${username}`);
    return res.data.data;
  },

  async getById(id: number): Promise<User> {
    const res = await api.get<ApiResponse<User>>(`/users/${id}`);
    return res.data.data;
  },

  async updateProfile(id: number, data: any): Promise<User> {
    const res = await api.put<ApiResponse<User>>(`/users/${id}`, data);
    return res.data.data;
  },

  async search(q: string): Promise<User[]> {
    const res = await api.get<ApiResponse<User[]>>('/users/search', { params: { q } });
    return res.data.data;
  },

  async getSuggestions(): Promise<User[]> {
    const res = await api.get<ApiResponse<User[]>>('/users/suggestions');
    return res.data.data;
  },

  async follow(id: number): Promise<void> {
    await api.post(`/users/${id}/follow`);
  },

  async unfollow(id: number): Promise<void> {
    await api.delete(`/users/${id}/follow`);
  },

  async getFollowers(id: number): Promise<User[]> {
    const res = await api.get<ApiResponse<User[]>>(`/users/${id}/followers`);
    return res.data.data;
  },

  async getFollowing(id: number): Promise<User[]> {
    const res = await api.get<ApiResponse<User[]>>(`/users/${id}/following`);
    return res.data.data;
  }
};
