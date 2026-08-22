import { env } from '../config/env.js';
import { getRepositoryManager } from './index.js';
import { IUserRepository, IPostRepository, ICommentRepository, INotificationRepository, IStoryRepository, IReelRepository, IMessageRepository, IAuthRepository, ISecurityRepository, IFcmTokenRepository, IPrivacyRepository } from './types.js';
import { GroupRepository, OracleGroupRepository } from './group.repository.js';
import { BroadcastRepository, OracleBroadcastRepository } from './broadcast.repository.js';
import { PostgresGroupRepository } from './postgres/group.postgres.repo.js';
import { PostgresBroadcastRepository } from './postgres/broadcast.postgres.repo.js';

const oracleGroupRepo = new OracleGroupRepository();
const postgresGroupRepo = new PostgresGroupRepository();

const oracleBroadcastRepo = new OracleBroadcastRepository();
const postgresBroadcastRepo = new PostgresBroadcastRepository();

export function getUserRepository(): IUserRepository {
  return getRepositoryManager().userRepo;
}

export function getPostRepository(): IPostRepository {
  return getRepositoryManager().postRepo;
}

export function getCommentRepository(): ICommentRepository {
  return getRepositoryManager().commentRepo;
}

export function getNotificationRepository(): INotificationRepository {
  return getRepositoryManager().notificationRepo;
}

export function getStoryRepository(): IStoryRepository {
  return getRepositoryManager().storyRepo;
}

export function getReelRepository(): IReelRepository {
  return getRepositoryManager().reelRepo;
}

export function getMessageRepository(): IMessageRepository {
  return getRepositoryManager().messageRepo;
}

export function getAuthRepository(): IAuthRepository {
  return getRepositoryManager().authRepo;
}

export function getSecurityRepository(): ISecurityRepository {
  return getRepositoryManager().securityRepo;
}

export function getFcmTokenRepository(): IFcmTokenRepository {
  return getRepositoryManager().fcmTokenRepo;
}

export function getPrivacyRepository(): IPrivacyRepository {
  return getRepositoryManager().privacyRepo;
}

export function getGroupRepository(): GroupRepository {
  if (env.DATABASE_PROVIDER === 'postgres') {
    return postgresGroupRepo;
  }
  return oracleGroupRepo;
}

export function getBroadcastRepository(): BroadcastRepository {
  if (env.DATABASE_PROVIDER === 'postgres') {
    return postgresBroadcastRepo;
  }
  return oracleBroadcastRepo;
}
