import axios from 'axios';

export const API_BASE_URL =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:4000/api'
    : 'https://nexa-backend-in6s.onrender.com/api';

// Access token is held strictly in-memory for security
let inMemoryAccessToken: string | null = null;

export function setAccessToken(token: string | null, _refreshToken?: string | null) {
  inMemoryAccessToken = token;
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function clearAuthSession() {
  inMemoryAccessToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('nexa_user_session');
    localStorage.removeItem('nexa_access_token');
    localStorage.removeItem('nexa_refresh_token');
  }
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'bypass-tunnel-reminder': 'true'
  }
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 Unauthorized for non-auth requests
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url !== '/auth/refresh' &&
      originalRequest.url !== '/auth/login' &&
      originalRequest.url !== '/auth/register'
    ) {
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Refresh token is transmitted via HttpOnly cookie (withCredentials: true)
        const res = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          {},
          {
            withCredentials: true,
            headers: {
              'bypass-tunnel-reminder': 'true'
            }
          }
        );

        const newAccessToken = res.data?.data?.accessToken;

        if (newAccessToken) {
          setAccessToken(newAccessToken);
          processQueue(null, newAccessToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        } else {
          throw new Error('No access token returned from refresh endpoint');
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        clearAuthSession();

        // Redirect to login if in browser and not already on an auth page
        if (
          typeof window !== 'undefined' &&
          window.location.pathname !== '/login' &&
          window.location.pathname !== '/register'
        ) {
          window.location.href = `/login?from=${encodeURIComponent(window.location.pathname)}`;
        }

        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export const authApi = {
  login: (data: any) => api.post('/auth/login', data),
  register: (data: any) => api.post('/auth/register', data),
  refresh: () => api.post('/auth/refresh'),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (data: { token: string; newPassword: string }) => api.post('/auth/reset-password', data),
  verifyEmail: (email: string, code: string) => api.post('/auth/verify-email', { email, code }),
  resendVerification: (email?: string) => api.post('/auth/resend-verification', { email })
};

export const userApi = {
  getByUsername: (username: string) => api.get(`/users/username/${username}`),
  getById: (id: number) => api.get(`/users/${id}`),
  updateProfile: (id: number, data: any) => api.put(`/users/${id}`, data),
  search: (query: string) => api.get(`/users/search?q=${encodeURIComponent(query)}`),
  getSuggestions: () => api.get('/users/suggestions'),
  follow: (id: number) => api.post(`/users/${id}/follow`),
  unfollow: (id: number) => api.delete(`/users/${id}/follow`),
  getFollowers: (id: number) => api.get(`/users/${id}/followers`),
  getFollowing: (id: number) => api.get(`/users/${id}/following`)
};

export const postApi = {
  create: (data: any) => api.post('/posts/create', data),
  getById: (id: number) => api.get(`/posts/${id}`),
  delete: (id: number) => api.delete(`/posts/${id}`),
  getFeed: (scope = 'global', cursor?: number, limit = 10) =>
    api.get(`/posts/feed?scope=${scope}${cursor ? `&cursor=${cursor}` : ''}&limit=${limit}`),
  like: (id: number) => api.post(`/posts/${id}/like`),
  unlike: (id: number) => api.delete(`/posts/${id}/like`),
  bookmark: (id: number) => api.post(`/posts/${id}/bookmark`),
  unbookmark: (id: number) => api.delete(`/posts/${id}/bookmark`),
  getBookmarks: (cursor?: number, limit = 10) =>
    api.get(`/posts/bookmarks?${cursor ? `cursor=${cursor}&` : ''}limit=${limit}`),
  addComment: (postId: number, content: string) => api.post(`/posts/${postId}/comment`, { content }),
  getComments: (postId: number) => api.get(`/posts/${postId}/comments`),
  deleteComment: (postId: number, commentId: number) => api.delete(`/posts/${postId}/comments/${commentId}`)
};

export const notificationApi = {
  list: (cursor?: number, limit = 20) =>
    api.get(`/notifications?${cursor ? `cursor=${cursor}&` : ''}limit=${limit}`),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id: number) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: () => api.post('/notifications/read-all')
};
