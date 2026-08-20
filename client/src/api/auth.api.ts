import { api, setAccessToken, clearAuthSession } from './client.js';
import { User, ApiResponse } from '../types/index.js';

export const authApi = {
  async register(data: {
    username: string;
    email: string;
    password: string;
    displayName: string;
    bio?: string;
  }): Promise<{ user: User; accessToken: string; refreshToken?: string }> {
    const res = await api.post<ApiResponse<{ user: User; accessToken: string; refreshToken?: string }>>(
      '/auth/register',
      data
    );
    setAccessToken(res.data.data.accessToken);
    return res.data.data;
  },

  async login(data: {
    emailOrUsername: string;
    password: string;
  }): Promise<{ user: User; accessToken: string; refreshToken?: string }> {
    const res = await api.post<ApiResponse<{ user: User; accessToken: string; refreshToken?: string }>>(
      '/auth/login',
      data
    );
    setAccessToken(res.data.data.accessToken);
    return res.data.data;
  },

  async refresh(): Promise<string> {
    const res = await api.post<ApiResponse<{ accessToken: string; refreshToken?: string }>>('/auth/refresh', {});
    setAccessToken(res.data.data.accessToken);
    return res.data.data.accessToken;
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout', {});
    } finally {
      clearAuthSession();
    }
  },

  async me(): Promise<User> {
    const res = await api.get<ApiResponse<User>>('/auth/me');
    return res.data.data;
  },

  async forgotPassword(email: string): Promise<{ message: string }> {
    const res = await api.post<ApiResponse<{ message: string }>>('/auth/forgot-password', { email });
    return res.data.data;
  },

  async resetPassword(data: { token: string; newPassword: string }): Promise<{ message: string }> {
    const res = await api.post<ApiResponse<{ message: string }>>('/auth/reset-password', data);
    return res.data.data;
  },

  async verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
    const res = await api.post<ApiResponse<{ success: boolean; message: string }>>('/auth/verify-email', { token });
    return res.data.data;
  },

  async resendVerification(email?: string): Promise<{ message: string }> {
    const res = await api.post<ApiResponse<{ message: string }>>('/auth/resend-verification', { email });
    return res.data.data;
  }
};
