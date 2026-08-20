import { IRepositoryManager } from '../types.js';
import { OracleUserRepository } from './user.oracle.repo.js';
import { OraclePostRepository } from './post.oracle.repo.js';
import { OracleCommentRepository } from './comment.oracle.repo.js';
import { OracleNotificationRepository } from './notification.oracle.repo.js';
import { OracleStoryRepository } from './story.oracle.repo.js';
import { OracleReelRepository } from './reel.oracle.repo.js';
import { OracleMessageRepository } from './message.oracle.repo.js';
import { OracleAuthRepository } from './auth.oracle.repo.js';
import { OracleSecurityRepository } from './security.oracle.repo.js';
import { OracleFcmTokenRepository } from './fcm.oracle.repo.js';
import { oraclePrivacyRepo } from './privacy.oracle.repo.js';

export const oracleRepositoryManager: IRepositoryManager = {
  userRepo: new OracleUserRepository(),
  postRepo: new OraclePostRepository(),
  commentRepo: new OracleCommentRepository(),
  notificationRepo: new OracleNotificationRepository(),
  storyRepo: new OracleStoryRepository(),
  reelRepo: new OracleReelRepository(),
  messageRepo: new OracleMessageRepository(),
  authRepo: new OracleAuthRepository(),
  securityRepo: new OracleSecurityRepository(),
  fcmTokenRepo: new OracleFcmTokenRepository(),
  privacyRepo: oraclePrivacyRepo,
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
