import { Response, NextFunction } from 'express';
import { UserService } from '../services/user.service.js';
import { AuthenticatedRequest } from '../types/index.js';
import { sendSuccess } from '../utils/response.js';

const userService = new UserService();

export class UserController {
  async getProfileById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = Number(req.params.id);
      const currentUserId = req.user?.userId;
      const user = await userService.getUserById(userId, currentUserId);
      return sendSuccess(res, user);
    } catch (err) {
      next(err);
    }
  }

  async getProfileByUsername(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const username = req.params.username;
      const currentUserId = req.user?.userId;
      const user = await userService.getUserByUsername(username, currentUserId);
      return sendSuccess(res, user);
    } catch (err) {
      next(err);
    }
  }

  async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const targetUserId = Number(req.params.id);
      if (req.user?.userId !== targetUserId) {
        return res.status(403).json({
          error: { code: 'FORBIDDEN', message: 'You can only edit your own profile', details: [] }
        });
      }
      const updated = await userService.updateProfile(targetUserId, req.body);
      return sendSuccess(res, updated, 'Profile updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async searchUsers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const query = String(req.query.q || '');
      const limit = Number(req.query.limit) || 10;
      const currentUserId = req.user?.userId;
      const results = await userService.searchUsers(query, currentUserId, limit);
      return sendSuccess(res, results);
    } catch (err) {
      next(err);
    }
  }

  async getSuggestions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Auth required', details: [] } });
      const limit = Number(req.query.limit) || 5;
      const suggestions = await userService.getSuggestions(req.user.userId, limit);
      return sendSuccess(res, suggestions);
    } catch (err) {
      next(err);
    }
  }

  async followUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Auth required', details: [] } });
      const targetUserId = Number(req.params.id);
      await userService.followUser(req.user.userId, targetUserId);
      return sendSuccess(res, null, 'Followed user successfully');
    } catch (err) {
      next(err);
    }
  }

  async unfollowUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Auth required', details: [] } });
      const targetUserId = Number(req.params.id);
      await userService.unfollowUser(req.user.userId, targetUserId);
      return sendSuccess(res, null, 'Unfollowed user successfully');
    } catch (err) {
      next(err);
    }
  }

  async getFollowers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const targetUserId = Number(req.params.id);
      const currentUserId = req.user?.userId;
      const followers = await userService.getFollowers(targetUserId, currentUserId);
      return sendSuccess(res, followers);
    } catch (err) {
      next(err);
    }
  }

  async getFollowing(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const targetUserId = Number(req.params.id);
      const currentUserId = req.user?.userId;
      const following = await userService.getFollowing(targetUserId, currentUserId);
      return sendSuccess(res, following);
    } catch (err) {
      next(err);
    }
  }
}
