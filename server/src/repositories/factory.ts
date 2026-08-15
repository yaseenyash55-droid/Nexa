import { env } from '../config/env.js';
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

import { OracleUserRepository } from './oracle/user.oracle.repo.js';
import { OraclePostRepository } from './oracle/post.oracle.repo.js';
import { OracleCommentRepository } from './oracle/comment.oracle.repo.js';
import { OracleNotificationRepository } from './oracle/notification.oracle.repo.js';
import { OracleAuthRepository } from './oracle/auth.oracle.repo.js';
import { OracleMessageRepository } from './oracle/message.oracle.repo.js';
import { OracleSecurityRepository } from './oracle/security.oracle.repo.js';
import { OracleStoryRepository } from './oracle/story.oracle.repo.js';
import { OracleReelRepository } from './oracle/reel.oracle.repo.js';

import { 
  MockUserRepository, 
  MockPostRepository, 
  MockCommentRepository, 
  MockNotificationRepository, 
  MockStoryRepository,
  MockReelRepository,
  MockMessageRepository,
  MockAuthRepository,
  MockSecurityRepository 
} from './mock/mock.repo.js';

const mockUserRepo = new MockUserRepository();
const mockPostRepo = new MockPostRepository();
const mockCommentRepo = new MockCommentRepository();
const mockNotificationRepo = new MockNotificationRepository();
const mockStoryRepo = new MockStoryRepository();
const mockReelRepo = new MockReelRepository();
const mockMessageRepo = new MockMessageRepository();
const mockAuthRepo = new MockAuthRepository();
const mockSecurityRepo = new MockSecurityRepository();

export function getUserRepository(): IUserRepository {
  const isOracle = (process.env.DATA_SOURCE || env.DATA_SOURCE) === 'oracle';
  return isOracle ? new OracleUserRepository() : mockUserRepo;
}

export function getPostRepository(): IPostRepository {
  const isOracle = (process.env.DATA_SOURCE || env.DATA_SOURCE) === 'oracle';
  return isOracle ? new OraclePostRepository() : mockPostRepo;
}

export function getCommentRepository(): ICommentRepository {
  const isOracle = (process.env.DATA_SOURCE || env.DATA_SOURCE) === 'oracle';
  return isOracle ? new OracleCommentRepository() : mockCommentRepo;
}

export function getNotificationRepository(): INotificationRepository {
  const isOracle = (process.env.DATA_SOURCE || env.DATA_SOURCE) === 'oracle';
  return isOracle ? new OracleNotificationRepository() : mockNotificationRepo;
}

export function getStoryRepository(): IStoryRepository {
  const isOracle = (process.env.DATA_SOURCE || env.DATA_SOURCE) === 'oracle';
  return isOracle ? new OracleStoryRepository() : mockStoryRepo;
}

export function getReelRepository(): IReelRepository {
  const isOracle = (process.env.DATA_SOURCE || env.DATA_SOURCE) === 'oracle';
  return isOracle ? new OracleReelRepository() : mockReelRepo;
}

export function getMessageRepository(): IMessageRepository {
  const isOracle = (process.env.DATA_SOURCE || env.DATA_SOURCE) === 'oracle';
  return isOracle ? new OracleMessageRepository() : mockMessageRepo;
}

export function getAuthRepository(): IAuthRepository {
  const isOracle = (process.env.DATA_SOURCE || env.DATA_SOURCE) === 'oracle';
  return isOracle ? new OracleAuthRepository() : mockAuthRepo;
}

export function getSecurityRepository(): ISecurityRepository {
  const isOracle = (process.env.DATA_SOURCE || env.DATA_SOURCE) === 'oracle';
  return isOracle ? new OracleSecurityRepository() : mockSecurityRepo;
}
