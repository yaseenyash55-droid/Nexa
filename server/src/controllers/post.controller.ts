import { Response, NextFunction } from 'express';
import { PostService } from '../services/post.service.js';
import { AuthenticatedRequest } from '../types/index.js';
import { sendSuccess } from '../utils/response.js';

const postService = new PostService();

export class PostController {
  async createPost(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Auth required', details: [] } });
      const post = await postService.createPost({
        userId: req.user.userId,
        content: req.body.content,
        imageUrl: req.body.imageUrl
      });
      return sendSuccess(res, post, 'Post created successfully', undefined, 201);
    } catch (err) {
      next(err);
    }
  }

  async getPostById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const postId = Number(req.params.id);
      const currentUserId = req.user?.userId;
      const post = await postService.getPostById(postId, currentUserId);
      return sendSuccess(res, post);
    } catch (err) {
      next(err);
    }
  }

  async updatePost(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Auth required', details: [] } });
      const postId = Number(req.params.id);
      const { content, tags, collaborator } = req.body;
      const updated = await postService.updatePost(postId, req.user.userId, { content, tags, collaborator });
      return sendSuccess(res, updated, 'Post updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async deletePost(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Auth required', details: [] } });
      const postId = Number(req.params.id);
      await postService.deletePost(postId, req.user.userId);
      return sendSuccess(res, null, 'Post deleted successfully');
    } catch (err) {
      next(err);
    }
  }

  async getFeed(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const scope = String(req.query.scope || 'global');
      const cursor = req.query.cursor ? Number(req.query.cursor) : undefined;
      const limit = Number(req.query.limit) || 10;
      const currentUserId = req.user?.userId;

      let result;
      if (scope === 'following') {
        if (!currentUserId) {
          return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Auth required for following feed', details: [] } });
        }
        result = await postService.getFollowingFeed(currentUserId, cursor, limit);
      } else {
        result = await postService.getGlobalFeed(currentUserId, cursor, limit);
      }

      return sendSuccess(res, result.data, undefined, { nextCursor: result.nextCursor, hasMore: result.hasMore });
    } catch (err) {
      next(err);
    }
  }

  async likePost(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Auth required', details: [] } });
      const postId = Number(req.params.id);
      await postService.likePost(req.user.userId, postId);
      return sendSuccess(res, null, 'Liked post');
    } catch (err) {
      next(err);
    }
  }

  async unlikePost(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Auth required', details: [] } });
      const postId = Number(req.params.id);
      await postService.unlikePost(req.user.userId, postId);
      return sendSuccess(res, null, 'Unliked post');
    } catch (err) {
      next(err);
    }
  }

  async bookmarkPost(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Auth required', details: [] } });
      const postId = Number(req.params.id);
      await postService.bookmarkPost(req.user.userId, postId);
      return sendSuccess(res, null, 'Bookmarked post');
    } catch (err) {
      next(err);
    }
  }

  async unbookmarkPost(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Auth required', details: [] } });
      const postId = Number(req.params.id);
      await postService.unbookmarkPost(req.user.userId, postId);
      return sendSuccess(res, null, 'Unbookmarked post');
    } catch (err) {
      next(err);
    }
  }

  async getUserBookmarks(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Auth required', details: [] } });
      const cursor = req.query.cursor ? Number(req.query.cursor) : undefined;
      const limit = Number(req.query.limit) || 10;
      const result = await postService.getUserBookmarks(req.user.userId, cursor, limit);
      return sendSuccess(res, result.data, undefined, { nextCursor: result.nextCursor, hasMore: result.hasMore });
    } catch (err) {
      next(err);
    }
  }

  async addComment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Auth required', details: [] } });
      const postId = Number(req.params.id);
      const comment = await postService.addComment({
        postId,
        userId: req.user.userId,
        content: req.body.content
      });
      return sendSuccess(res, comment, 'Comment added', undefined, 201);
    } catch (err) {
      next(err);
    }
  }

  async getPostComments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const postId = Number(req.params.id);
      const cursor = req.query.cursor ? Number(req.query.cursor) : undefined;
      const limit = Number(req.query.limit) || 20;
      const result = await postService.getPostComments(postId, cursor, limit);
      return sendSuccess(res, result.data, undefined, { nextCursor: result.nextCursor, hasMore: result.hasMore });
    } catch (err) {
      next(err);
    }
  }

  async deleteComment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Auth required', details: [] } });
      const postId = Number(req.params.postId);
      const commentId = Number(req.params.commentId);
      await postService.deleteComment(commentId, postId, req.user.userId);
      return sendSuccess(res, null, 'Comment deleted');
    } catch (err) {
      next(err);
    }
  }
}
