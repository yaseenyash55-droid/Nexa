import axios from 'axios';

export const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:4000/api'
  : 'https://nexa-backend-in6s.onrender.com/api';

let inMemoryAccessToken: string | null = typeof window !== 'undefined' ? localStorage.getItem('nexa_access_token') : null;
let inMemoryRefreshToken: string | null = typeof window !== 'undefined' ? localStorage.getItem('nexa_refresh_token') : null;

export function setAccessToken(token: string | null, refreshToken?: string | null) {
  inMemoryAccessToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      localStorage.setItem('nexa_access_token', token);
    } else {
      localStorage.removeItem('nexa_access_token');
    }
    if (refreshToken !== undefined) {
      if (refreshToken) {
        localStorage.setItem('nexa_refresh_token', refreshToken);
        inMemoryRefreshToken = refreshToken;
      } else {
        localStorage.removeItem('nexa_refresh_token');
        inMemoryRefreshToken = null;
      }
    }
  }
}

export function getAccessToken(): string | null {
  if (inMemoryAccessToken) return inMemoryAccessToken;
  return typeof window !== 'undefined' ? localStorage.getItem('nexa_access_token') : null;
}

export function getRefreshToken(): string | null {
  if (inMemoryRefreshToken) return inMemoryRefreshToken;
  const stored = typeof window !== 'undefined' ? localStorage.getItem('nexa_refresh_token') : null;
  if (stored) return stored;
  return getAccessToken();
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
  failedQueue.forEach(prom => {
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
    if (error.response?.status === 401 && !originalRequest._retry && originalRequest.url !== '/auth/refresh' && originalRequest.url !== '/auth/login') {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const currentToken = getAccessToken();
        const storedRefreshToken = getRefreshToken() || currentToken;

        const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken: storedRefreshToken }, {
          withCredentials: true,
          headers: {
            'bypass-tunnel-reminder': 'true',
            'Authorization': currentToken ? `Bearer ${currentToken}` : ''
          }
        });
        const newAccessToken = res.data?.data?.accessToken;
        const newRefreshToken = res.data?.data?.refreshToken;
        if (newAccessToken) {
          setAccessToken(newAccessToken, newRefreshToken);
          processQueue(null, newAccessToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        const currentToken = getAccessToken();
        if (currentToken) {
          originalRequest.headers.Authorization = `Bearer ${currentToken}`;
          return axios(originalRequest);
        }
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
  me: () => api.get('/auth/me')
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
  list: (cursor?: number, limit = 20) => api.get(`/notifications?${cursor ? `cursor=${cursor}&` : ''}limit=${limit}`),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (id: number) => api.patch(`/notifications/${id}/read`),
  markAllAsRead: () => api.post('/notifications/read-all')
};
