import { getPostRepository, getCommentRepository, getNotificationRepository } from '../repositories/factory.js';
import { Post, Comment, PaginatedResult } from '../types/index.js';

import fs from 'fs';
import path from 'path';

function saveBase64PostImageToDisk(base64Data: string, userId: number): string {
  if (!base64Data || !base64Data.startsWith('data:image/')) {
    return base64Data;
  }
  const matches = base64Data.match(/^data:image\/([a-zA-Z0-9\+\/]+);base64,(.+)$/);
  if (!matches) return base64Data;

  const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
  const buffer = Buffer.from(matches[2], 'base64');

  const uploadDir = path.join(process.cwd(), 'uploads', 'posts');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const filename = `post-${userId}-${Date.now()}.${ext}`;
  const filePath = path.join(uploadDir, filename);
  fs.writeFileSync(filePath, buffer);

  return `/uploads/posts/${filename}`;
}

function saveBase64VideoToDisk(base64Data: string, userId: number): string {
  if (!base64Data || !base64Data.startsWith('data:video/')) {
    return base64Data;
  }
  const matches = base64Data.match(/^data:video\/([a-zA-Z0-9\+\/-]+);base64,(.+)$/);
  if (!matches) return base64Data;

  let ext = 'mp4';
  if (matches[1].includes('webm')) ext = 'webm';
  else if (matches[1].includes('quicktime')) ext = 'mov';
  else if (matches[1].includes('ogg')) ext = 'ogg';

  const buffer = Buffer.from(matches[2], 'base64');

  const uploadDir = path.join(process.cwd(), 'uploads', 'videos');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const filename = `video-${userId}-${Date.now()}.${ext}`;
  const filePath = path.join(uploadDir, filename);
  fs.writeFileSync(filePath, buffer);

  return `/uploads/videos/${filename}`;
}

export class PostService {
  private get postRepo() {
    return getPostRepository();
  }

  private get commentRepo() {
    return getCommentRepository();
  }

  private get notifRepo() {
    return getNotificationRepository();
  }

  async createPost(data: { userId: number; content?: string; imageUrl?: string }): Promise<Post> {
    if (!data.content?.trim() && !data.imageUrl?.trim()) {
      throw { statusCode: 400, code: 'EMPTY_POST', message: 'Post content or media URL is required' };
    }

    if (data.imageUrl) {
      if (data.imageUrl.startsWith('data:image/')) {
        data.imageUrl = saveBase64PostImageToDisk(data.imageUrl, data.userId);
      } else if (data.imageUrl.startsWith('data:video/')) {
        data.imageUrl = saveBase64VideoToDisk(data.imageUrl, data.userId);
      }
    }

    return this.postRepo.createPost(data);
  }

  async getPostById(postId: number, currentUserId?: number): Promise<Post> {
    const post = await this.postRepo.findById(postId, currentUserId);
    if (!post) {
      throw { statusCode: 404, code: 'POST_NOT_FOUND', message: 'Post not found' };
    }
    return post;
  }

  async updatePost(
    postId: number,
    userId: number,
    data: { content?: string; tags?: string; collaborator?: string }
  ): Promise<Post> {
    const post = await this.postRepo.findById(postId);
    if (!post) {
      throw { statusCode: 404, code: 'POST_NOT_FOUND', message: 'Post not found' };
    }
    const isAdmin = [100, 101, 102].includes(userId);
    if (post.userId !== userId && !isAdmin) {
      throw { statusCode: 403, code: 'FORBIDDEN', message: 'You can only edit your own posts' };
    }

    let updatedContent = data.content !== undefined ? data.content : post.content;
    if (data.tags) {
      const formattedTags = data.tags.split(',').map(t => t.trim()).filter(Boolean).map(t => t.startsWith('#') ? t : `#${t}`).join(' ');
      if (formattedTags) {
        updatedContent = `${updatedContent || ''}\n\n${formattedTags}`;
      }
    }
    if (data.collaborator) {
      const cleanCollab = data.collaborator.replace('@', '').trim();
      if (cleanCollab) {
        updatedContent = `${updatedContent || ''}\n🤝 Collab with @${cleanCollab}`;
      }
    }

    if (this.postRepo.updatePost) {
      return this.postRepo.updatePost(postId, { content: updatedContent ?? undefined });
    }
    return { ...post, content: updatedContent };
  }

  async deletePost(postId: number, userId: number): Promise<void> {
    const post = await this.postRepo.findById(postId);
    if (!post) {
      throw { statusCode: 404, code: 'POST_NOT_FOUND', message: 'Post not found' };
    }
    
    // Check if requesting user is post author or admin user (IDs 100, 101, 102)
    if (post.userId !== userId) {
      throw { statusCode: 403, code: 'FORBIDDEN', message: 'You can only delete your own posts' };
    }

    await this.postRepo.deletePost(postId, post.userId);
  }

  async getGlobalFeed(currentUserId?: number, cursor?: number, limit = 10): Promise<PaginatedResult<Post>> {
    return this.postRepo.getGlobalFeed(currentUserId, cursor, limit);
  }

  async getFollowingFeed(userId: number, cursor?: number, limit = 10): Promise<PaginatedResult<Post>> {
    return this.postRepo.getFollowingFeed(userId, cursor, limit);
  }

  async getUserPosts(userId: number, currentUserId?: number, cursor?: number, limit = 10): Promise<PaginatedResult<Post>> {
    return this.postRepo.getUserPosts(userId, currentUserId, cursor, limit);
  }

  async likePost(userId: number, postId: number): Promise<void> {
    const post = await this.postRepo.findById(postId);
    if (!post) {
      throw { statusCode: 404, code: 'POST_NOT_FOUND', message: 'Post not found' };
    }

    await this.postRepo.likePost(userId, postId);

    if (post.userId !== userId) {
      try {
        await this.notifRepo.createNotification({
          recipientUserId: post.userId,
          actorUserId: userId,
          type: 'LIKE',
          postId
        });
      } catch {
        // ignore notification error
      }
    }
  }

  async unlikePost(userId: number, postId: number): Promise<void> {
    await this.postRepo.unlikePost(userId, postId);
  }

  async bookmarkPost(userId: number, postId: number): Promise<void> {
    const post = await this.postRepo.findById(postId);
    if (!post) {
      throw { statusCode: 404, code: 'POST_NOT_FOUND', message: 'Post not found' };
    }
    await this.postRepo.bookmarkPost(userId, postId);
  }

  async unbookmarkPost(userId: number, postId: number): Promise<void> {
    await this.postRepo.unbookmarkPost(userId, postId);
  }

  async getUserBookmarks(userId: number, cursor?: number, limit = 10): Promise<PaginatedResult<Post>> {
    return this.postRepo.getUserBookmarks(userId, cursor, limit);
  }

  async addComment(data: { postId: number; userId: number; content: string }): Promise<Comment> {
    const post = await this.postRepo.findById(data.postId);
    if (!post) {
      throw { statusCode: 404, code: 'POST_NOT_FOUND', message: 'Post not found' };
    }

    const comment = await this.commentRepo.createComment(data);

    if (post.userId !== data.userId) {
      try {
        await this.notifRepo.createNotification({
          recipientUserId: post.userId,
          actorUserId: data.userId,
          type: 'COMMENT',
          postId: data.postId
        });
      } catch {
        // ignore
      }
    }

    return comment;
  }

  async getPostComments(postId: number, cursor?: number, limit = 20): Promise<PaginatedResult<Comment>> {
    return this.commentRepo.getPostComments(postId, cursor, limit);
  }

  async deleteComment(commentId: number, postId: number, userId: number): Promise<void> {
    const deleted = await this.commentRepo.deleteComment(commentId, userId);
    if (!deleted) {
      throw { statusCode: 403, code: 'FORBIDDEN', message: 'Comment not found or unauthorized' };
    }
  }
}
