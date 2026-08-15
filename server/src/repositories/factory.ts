import { getRepositoryManager } from './index.js';
import { 
  IUserRepository, 
  IPostRepository, 
  ICommentRepository, 
  INotificationRepository, 
  IStoryRepository,
  IReelRepository,
  IMessageRepository,
  IAuthRepository,
  ISecurityRepository 
} from './types.js';
import { GroupRepository, MockGroupRepository, OracleGroupRepository } from './group.repository.js';
import { BroadcastRepository, MockBroadcastRepository, OracleBroadcastRepository } from './broadcast.repository.js';
import { env } from '../config/env.js';

const mockGroupRepo = new MockGroupRepository();
const oracleGroupRepo = new OracleGroupRepository();

const mockBroadcastRepo = new MockBroadcastRepository();
const oracleBroadcastRepo = new OracleBroadcastRepository();

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

export function getGroupRepository(): GroupRepository {
  return env.DATA_SOURCE === 'oracle' ? oracleGroupRepo : mockGroupRepo;
}

export function getBroadcastRepository(): BroadcastRepository {
  return env.DATA_SOURCE === 'oracle' ? oracleBroadcastRepo : mockBroadcastRepo;
}
