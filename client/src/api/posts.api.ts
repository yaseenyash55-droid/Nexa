import { api } from './client.js';
import { Post, Comment, ApiResponse } from '../types/index.js';

export const postsApi = {
  async getFeed(scope: 'global' | 'following' = 'global', cursor?: number): Promise<ApiResponse<Post[]>> {
    const res = await api.get<ApiResponse<Post[]>>('/posts/feed', {
      params: { scope, cursor, limit: 10 }
    });
    return res.data;
  },

  async createPost(data: { content?: string; imageUrl?: string }): Promise<Post> {
    const res = await api.post<ApiResponse<Post>>('/posts/create', data);
    return res.data.data;
  },

  async getPostById(id: number): Promise<Post> {
    const res = await api.get<ApiResponse<Post>>(`/posts/${id}`);
    return res.data.data;
  },

  async updatePost(id: number, data: { content?: string; tags?: string; collaborator?: string }): Promise<Post> {
    const res = await api.put<ApiResponse<Post>>(`/posts/${id}`, data);
    return res.data.data;
  },

  async deletePost(id: number): Promise<void> {
    await api.delete(`/posts/${id}`);
  },

  async likePost(id: number): Promise<void> {
    await api.post(`/posts/${id}/like`);
  },

  async unlikePost(id: number): Promise<void> {
    await api.delete(`/posts/${id}/like`);
  },

  async bookmarkPost(id: number): Promise<void> {
    await api.post(`/posts/${id}/bookmark`);
  },

  async unbookmarkPost(id: number): Promise<void> {
    await api.delete(`/posts/${id}/bookmark`);
  },

  async getBookmarks(cursor?: number): Promise<ApiResponse<Post[]>> {
    const res = await api.get<ApiResponse<Post[]>>('/posts/bookmarks', { params: { cursor, limit: 10 } });
    return res.data;
  },

  async addComment(postId: number, content: string): Promise<Comment> {
    const res = await api.post<ApiResponse<Comment>>(`/posts/${postId}/comment`, { content });
    return res.data.data;
  },

  async getComments(postId: number, cursor?: number): Promise<ApiResponse<Comment[]>> {
    const res = await api.get<ApiResponse<Comment[]>>(`/posts/${postId}/comments`, { params: { cursor } });
    return res.data;
  },

  async deleteComment(postId: number, commentId: number): Promise<void> {
    await api.delete(`/posts/${postId}/comments/${commentId}`);
  }
};
