import { getPrivacyRepository, getUserRepository } from '../repositories/factory.js';
import { UserPrivacySettings } from '../types/index.js';

export class PrivacyService {
  private get privacyRepo() {
    return getPrivacyRepository();
  }
  private get userRepo() {
    return getUserRepository();
  }

  async getSettings(userId: number): Promise<UserPrivacySettings> {
    return this.privacyRepo.getPrivacySettings(userId);
  }

  async updateSettings(userId: number, updates: Partial<UserPrivacySettings>): Promise<UserPrivacySettings> {
    return this.privacyRepo.updatePrivacySettings(userId, updates);
  }

  async getHiddenWords(userId: number): Promise<string[]> {
    const words = await this.privacyRepo.getHiddenWords(userId);
    return words;
  }

  async setHiddenWords(userId: number, words: string[]): Promise<string[]> {
    if (!Array.isArray(words)) {
      throw { statusCode: 400, code: 'VALIDATION_ERROR', message: 'words must be an array of strings' };
    }
    const cleanWords = words
      .filter(w => typeof w === 'string')
      .map(w => w.trim().slice(0, 100))
      .filter(w => w.length > 0);

    return this.privacyRepo.setHiddenWords(userId, cleanWords);
  }

  async getBlockedUsers(userId: number): Promise<any[]> {
    return this.privacyRepo.getBlockedUsers(userId);
  }

  async blockUser(blockerId: number, targetUserId: number): Promise<void> {
    if (blockerId === targetUserId) {
      throw { statusCode: 400, code: 'SELF_BLOCK_FORBIDDEN', message: 'You cannot block yourself' };
    }
    const targetUser = await this.userRepo.findById(targetUserId);
    if (!targetUser) {
      throw { statusCode: 404, code: 'USER_NOT_FOUND', message: 'User to block not found' };
    }

    await this.privacyRepo.blockUser(blockerId, targetUserId);
  }

  async unblockUser(blockerId: number, targetUserId: number): Promise<void> {
    await this.privacyRepo.unblockUser(blockerId, targetUserId);
  }

  async isBlocked(userA: number, userB: number): Promise<boolean> {
    return this.privacyRepo.isBlocked(userA, userB);
  }

  async getFollowRequests(userId: number): Promise<any[]> {
    return this.privacyRepo.getPendingFollowRequests(userId);
  }

  async createFollowRequest(requesterId: number, targetUserId: number): Promise<{ requestId: number; status: string }> {
    if (requesterId === targetUserId) {
      throw { statusCode: 400, code: 'SELF_FOLLOW_FORBIDDEN', message: 'You cannot follow yourself' };
    }
    const targetUser = await this.userRepo.findById(targetUserId);
    if (!targetUser) {
      throw { statusCode: 404, code: 'USER_NOT_FOUND', message: 'Target user not found' };
    }

    const isBlocked = await this.privacyRepo.isBlocked(requesterId, targetUserId);
    if (isBlocked) {
      throw { statusCode: 403, code: 'ACTION_BLOCKED', message: 'Unable to follow this user' };
    }

    return this.privacyRepo.createFollowRequest(requesterId, targetUserId);
  }

  async approveFollowRequest(targetUserId: number, requestId: number): Promise<boolean> {
    const success = await this.privacyRepo.respondToFollowRequest(targetUserId, requestId, true);
    if (!success) {
      throw { statusCode: 404, code: 'REQUEST_NOT_FOUND', message: 'Follow request not found or already processed' };
    }
    return true;
  }

  async rejectFollowRequest(targetUserId: number, requestId: number): Promise<boolean> {
    const success = await this.privacyRepo.respondToFollowRequest(targetUserId, requestId, false);
    if (!success) {
      throw { statusCode: 404, code: 'REQUEST_NOT_FOUND', message: 'Follow request not found or already processed' };
    }
    return true;
  }

  async createReport(reporterUserId: number, data: {
    targetType: string;
    targetId: number;
    reason: string;
    details?: string;
  }): Promise<{ reportId: number; status: string }> {
    const validTargetTypes = ['USER', 'POST', 'COMMENT', 'STORY', 'REEL', 'MESSAGE'];
    const targetType = data.targetType.toUpperCase();

    if (!validTargetTypes.includes(targetType)) {
      throw { statusCode: 400, code: 'INVALID_TARGET_TYPE', message: `targetType must be one of: ${validTargetTypes.join(', ')}` };
    }

    if (!data.targetId || isNaN(data.targetId) || data.targetId <= 0) {
      throw { statusCode: 400, code: 'INVALID_TARGET_ID', message: 'targetId must be a positive integer' };
    }

    if (!data.reason || typeof data.reason !== 'string' || data.reason.trim().length < 2) {
      throw { statusCode: 400, code: 'INVALID_REASON', message: 'reason must be at least 2 characters' };
    }

    if (data.details && (typeof data.details !== 'string' || data.details.length > 1000)) {
      throw { statusCode: 400, code: 'DETAILS_TOO_LONG', message: 'details cannot exceed 1000 characters' };
    }

    return this.privacyRepo.createReport({
      reporterUserId,
      targetType,
      targetId: data.targetId,
      reason: data.reason.trim(),
      details: data.details ? data.details.trim() : undefined
    });
  }

  async getReports(userRole: string | undefined, filter?: { status?: string; targetType?: string }): Promise<any[]> {
    if (userRole !== 'ADMIN' && userRole !== 'MODERATOR') {
      throw { statusCode: 403, code: 'FORBIDDEN', message: 'Moderator or Administrator access required' };
    }
    return this.privacyRepo.getReports(filter);
  }

  async createModerationAction(moderatorUserId: number, userRole: string | undefined, data: {
    reportId?: number;
    actionType: string;
    targetType: string;
    targetId: number;
    notes?: string;
  }): Promise<{ actionId: number }> {
    if (userRole !== 'ADMIN' && userRole !== 'MODERATOR') {
      throw { statusCode: 403, code: 'FORBIDDEN', message: 'Moderator or Administrator access required' };
    }

    const validActions = ['WARN', 'HIDE_CONTENT', 'DELETE_CONTENT', 'SUSPEND_USER', 'BAN_USER', 'DISMISS_REPORT'];
    const actionType = data.actionType.toUpperCase();
    if (!validActions.includes(actionType)) {
      throw { statusCode: 400, code: 'INVALID_ACTION_TYPE', message: `actionType must be one of: ${validActions.join(', ')}` };
    }

    return this.privacyRepo.createModerationAction({
      reportId: data.reportId,
      moderatorUserId,
      actionType,
      targetType: data.targetType.toUpperCase(),
      targetId: data.targetId,
      notes: data.notes ? data.notes.trim() : undefined
    });
  }
}

export const privacyService = new PrivacyService();
