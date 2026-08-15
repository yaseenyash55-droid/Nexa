import { api, setAccessToken } from './client.js';
import { User, ApiResponse } from '../types/index.js';

export const authApi = {
  async register(data: any): Promise<{ user: User; accessToken: string; refreshToken?: string }> {
    const res = await api.post<ApiResponse<{ user: User; accessToken: string; refreshToken?: string }>>('/auth/register', data);
    setAccessToken(res.data.data.accessToken, res.data.data.refreshToken);
    return res.data.data;
  },

  async login(data: any): Promise<{ user: User; accessToken: string; refreshToken?: string }> {
    const res = await api.post<ApiResponse<{ user: User; accessToken: string; refreshToken?: string }>>('/auth/login', data);
    setAccessToken(res.data.data.accessToken, res.data.data.refreshToken);
    return res.data.data;
  },

  async refresh(): Promise<string> {
    const storedRefreshToken = typeof window !== 'undefined' ? localStorage.getItem('nexa_refresh_token') : null;
    const res = await api.post<ApiResponse<{ accessToken: string; refreshToken?: string }>>('/auth/refresh', { refreshToken: storedRefreshToken });
    setAccessToken(res.data.data.accessToken, res.data.data.refreshToken);
    return res.data.data.accessToken;
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } finally {
      setAccessToken(null);
    }
  },

  async me(): Promise<User> {
    const res = await api.get<ApiResponse<User>>('/auth/me');
    return res.data.data;
  }
};
