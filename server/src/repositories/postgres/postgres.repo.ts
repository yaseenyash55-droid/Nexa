import { IRepositoryManager } from '../types.js';
import { PostgresUserRepository } from './user.postgres.repo.js';
import { PostgresPostRepository } from './post.postgres.repo.js';
import { PostgresCommentRepository } from './comment.postgres.repo.js';
import { PostgresNotificationRepository } from './notification.postgres.repo.js';
import { PostgresStoryRepository } from './story.postgres.repo.js';
import { PostgresReelRepository } from './reel.postgres.repo.js';
import { PostgresMessageRepository } from './message.postgres.repo.js';
import { PostgresAuthRepository } from './auth.postgres.repo.js';
import { PostgresSecurityRepository } from './security.postgres.repo.js';
import { PostgresFcmTokenRepository } from './fcm.postgres.repo.js';
import { postgresPrivacyRepo } from './privacy.postgres.repo.js';

export const postgresRepositoryManager: IRepositoryManager = {
  userRepo: new PostgresUserRepository(),
  postRepo: new PostgresPostRepository(),
  commentRepo: new PostgresCommentRepository(),
  notificationRepo: new PostgresNotificationRepository(),
  storyRepo: new PostgresStoryRepository(),
  reelRepo: new PostgresReelRepository(),
  messageRepo: new PostgresMessageRepository(),
  authRepo: new PostgresAuthRepository(),
  securityRepo: new PostgresSecurityRepository(),
  fcmTokenRepo: new PostgresFcmTokenRepository(),
  privacyRepo: postgresPrivacyRepo,
  get users() { return this.userRepo; },
  get posts() { return this.postRepo; },
  get comments() { return this.commentRepo; },
  get notifications() { return this.notificationRepo; },
  get stories() { return this.storyRepo; },
  get reels() { return this.reelRepo; },
  get messages() { return this.messageRepo; },
  get auth() { return this.authRepo; },
  get security() { return this.securityRepo; },
  get fcmTokens() { return this.fcmTokenRepo; },
  get privacy() { return this.privacyRepo; }
};
