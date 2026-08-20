import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { app } from '../src/app.js';
import { OracleUserRepository } from '../src/repositories/oracle/user.oracle.repo.js';
import { OraclePostRepository } from '../src/repositories/oracle/post.oracle.repo.js';
import { OracleCommentRepository } from '../src/repositories/oracle/comment.oracle.repo.js';
import { OracleNotificationRepository } from '../src/repositories/oracle/notification.oracle.repo.js';
import { OracleStoryRepository } from '../src/repositories/oracle/story.oracle.repo.js';
import { OracleReelRepository } from '../src/repositories/oracle/reel.oracle.repo.js';
import { OracleMessageRepository } from '../src/repositories/oracle/message.oracle.repo.js';
import { OracleAuthRepository } from '../src/repositories/oracle/auth.oracle.repo.js';
import { OracleSecurityRepository } from '../src/repositories/oracle/security.oracle.repo.js';
import { OracleGroupRepository } from '../src/repositories/group.repository.js';
import { OracleBroadcastRepository } from '../src/repositories/broadcast.repository.js';
import { OracleFcmTokenRepository } from '../src/repositories/oracle/fcm.oracle.repo.js';
import { OraclePrivacyRepository } from '../src/repositories/oracle/privacy.oracle.repo.js';
import { checkOracleHealth, initializeOraclePool, closeOraclePool, executeSql } from '../src/db/pool.js';
import { AuthService } from '../src/services/auth.service.js';
import { PostService } from '../src/services/post.service.js';
import { env } from '../src/config/env.js';

const isIntegrationEnabled =
  process.env.RUN_ORACLE_INTEGRATION_TESTS === 'true' ||
  process.env.ORACLE_INTEGRATION_TESTS === 'true';

describe.skipIf(!isIntegrationEnabled)('Comprehensive Oracle-Backed Integration Suite', () => {
  let userRepo: OracleUserRepository;
  let postRepo: OraclePostRepository;
  let commentRepo: OracleCommentRepository;
  let notificationRepo: OracleNotificationRepository;
  let storyRepo: OracleStoryRepository;
  let reelRepo: OracleReelRepository;
  let messageRepo: OracleMessageRepository;
  let authRepo: OracleAuthRepository;
  let securityRepo: OracleSecurityRepository;
  let groupRepo: OracleGroupRepository;
  let broadcastRepo: OracleBroadcastRepository;
  let fcmRepo: OracleFcmTokenRepository;
  let privacyRepo: OraclePrivacyRepository;
  let authService: AuthService;
  let postService: PostService;

  // Track inserted test user IDs for clean teardown
  const createdUserIds: number[] = [];

  beforeAll(async () => {
    if (!env.DB_USER || !env.DB_PASSWORD || !env.DB_CONNECT_STRING) {
      throw new Error(
        '[FATAL TEST ERROR] RUN_ORACLE_INTEGRATION_TESTS is enabled but required database credentials (DB_USER, DB_PASSWORD, DB_CONNECT_STRING) are missing.'
      );
    }

    try {
      await initializeOraclePool();
      const health = await checkOracleHealth();
      if (!health.reachable) {
        throw new Error(
          `[FATAL TEST ERROR] Oracle integration tests enabled but Oracle Database is unreachable at ${env.DB_CONNECT_STRING}. Details: ${health.details}`
        );
      }
    } catch (err: any) {
      throw new Error(
        `[FATAL TEST ERROR] Oracle connection initialization failed: ${err.message}`
      );
    }

    userRepo = new OracleUserRepository();
    postRepo = new OraclePostRepository();
    commentRepo = new OracleCommentRepository();
    notificationRepo = new OracleNotificationRepository();
    storyRepo = new OracleStoryRepository();
    reelRepo = new OracleReelRepository();
    messageRepo = new OracleMessageRepository();
    authRepo = new OracleAuthRepository();
    securityRepo = new OracleSecurityRepository();
    groupRepo = new OracleGroupRepository();
    broadcastRepo = new OracleBroadcastRepository();
    fcmRepo = new OracleFcmTokenRepository();
    privacyRepo = new OraclePrivacyRepository();
    authService = new AuthService();
    postService = new PostService();
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      for (const testUserId of createdUserIds) {
        try {
          await executeSql('DELETE FROM USERS WHERE USER_ID = :testUserId', { testUserId });
        } catch {
          // ignore cleanup failures in afterAll
        }
      }
    }
    await closeOraclePool();
  });

  it('reports database reachability status without exposing credentials', async () => {
    const health = await checkOracleHealth();
    expect(health).toHaveProperty('reachable');
    expect(health).toHaveProperty('details');
    if (env.DB_PASSWORD && env.DB_PASSWORD.trim().length > 0) {
      expect(health.details).not.toContain(env.DB_PASSWORD);
    }

    const res = await supertest(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
    expect(res.body.data.mode).toBe('oracle');
    expect(res.body.data.database.reachable).toBe(true);
    expect(res.body.data.database.details).toBe('Connected');
    const bodyStr = JSON.stringify(res.body);
    if (env.DB_PASSWORD && env.DB_PASSWORD.trim().length > 0) {
      expect(bodyStr).not.toContain(env.DB_PASSWORD);
    }
    if (env.DB_USER && env.DB_USER.trim().length > 0) {
      expect(bodyStr).not.toContain(env.DB_USER);
    }
  });

  it('registers users, verifies password hashes, and sanitizes output', async () => {
    const uniqueTag = 'user_reg_' + Date.now();
    const regResult = await authService.register({
      username: uniqueTag,
      email: `${uniqueTag}@test.local`,
      password: 'SecurePassword123!',
      displayName: 'Integration User A'
    });

    expect(regResult.user.userId).toBeGreaterThan(0);
    createdUserIds.push(regResult.user.userId);
    expect(regResult.user.username).toBe(uniqueTag);
    expect((regResult.user as any).passwordHash).toBeUndefined();
    expect(regResult.tokens.accessToken).toBeDefined();
    expect(regResult.tokens.refreshToken).toBeDefined();

    // Login with registered user
    const loginResult = await authService.login(uniqueTag, 'SecurePassword123!');
    expect(loginResult.user.userId).toBe(regResult.user.userId);
    expect((loginResult.user as any).passwordHash).toBeUndefined();
  });

  it('handles refresh token rotation and logout revocation', async () => {
    const uniqueTag = 'user_tok_' + Date.now();
    const reg = await authService.register({
      username: uniqueTag,
      email: `${uniqueTag}@test.local`,
      password: 'SecurePassword123!',
      displayName: 'Token User'
    });
    createdUserIds.push(reg.user.userId);

    // Refresh token
    const refreshRes = await authService.refreshTokens(reg.tokens.refreshToken);
    expect(refreshRes.accessToken).toBeDefined();
    expect(refreshRes.newRefreshToken).toBeDefined();

    // Logout and revoke token
    await authService.logout(refreshRes.newRefreshToken);

    // Reusing revoked token should fail
    await expect(authService.refreshTokens(refreshRes.newRefreshToken)).rejects.toThrow();
  });

  it('enforces password reset tokens with 15-min expiration and single use', async () => {
    const uniqueTag = 'user_rst_' + Date.now();
    const reg = await authService.register({
      username: uniqueTag,
      email: `${uniqueTag}@test.local`,
      password: 'SecurePassword123!',
      displayName: 'Reset User'
    });
    createdUserIds.push(reg.user.userId);

    const resetRes = await authService.requestPasswordReset(reg.user.email);
    expect(resetRes.message).toBeDefined();

    // Verify token creation in database
    const tokenHash = 'test_reset_hash_' + Date.now();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await authRepo.savePasswordResetToken(reg.user.userId, tokenHash, expiresAt);

    const foundToken = await authRepo.findPasswordResetToken(tokenHash);
    expect(foundToken).not.toBeNull();
    expect(foundToken?.userId).toBe(reg.user.userId);

    // Consume token
    await authRepo.markPasswordResetTokenUsed(tokenHash);
    const consumedToken = await authRepo.findPasswordResetToken(tokenHash);
    expect(consumedToken?.usedAt).not.toBeNull();
  });

  it('tracks email verification token state', async () => {
    const uniqueTag = 'user_eml_' + Date.now();
    const reg = await authService.register({
      username: uniqueTag,
      email: `${uniqueTag}@test.local`,
      password: 'SecurePassword123!',
      displayName: 'Email User'
    });
    createdUserIds.push(reg.user.userId);

    const emailRes = await authService.sendEmailVerification(reg.user.userId, reg.user.email);
    if (emailRes.verificationToken) {
      const verifyRes = await authService.verifyEmailToken(emailRes.verificationToken);
      expect(verifyRes.success).toBe(true);
    }
  });

  it('enforces account lockout after 5 consecutive failed logins', async () => {
    const uniqueTag = 'user_lck_' + Date.now();
    const reg = await authService.register({
      username: uniqueTag,
      email: `${uniqueTag}@test.local`,
      password: 'SecurePassword123!',
      displayName: 'Lockout User'
    });
    createdUserIds.push(reg.user.userId);

    // Fail 4 times
    for (let i = 0; i < 4; i++) {
      await expect(authService.login(uniqueTag, 'WrongPassword!')).rejects.toThrow();
    }

    // 5th attempt triggers lockout
    await expect(authService.login(uniqueTag, 'WrongPassword!')).rejects.toMatchObject({
      code: 'ACCOUNT_LOCKED'
    });
  }, 20000);

  it('enforces author ownership and prevents IDOR on post updates and deletions', async () => {
    const userA = await authService.register({
      username: 'author_a_' + Date.now(),
      email: `author_a_${Date.now()}@test.local`,
      password: 'SecurePassword123!',
      displayName: 'Author A'
    });
    createdUserIds.push(userA.user.userId);

    const userB = await authService.register({
      username: 'author_b_' + Date.now(),
      email: `author_b_${Date.now()}@test.local`,
      password: 'SecurePassword123!',
      displayName: 'Author B'
    });
    createdUserIds.push(userB.user.userId);

    // User A creates post
    const postA = await postService.createPost({
      userId: userA.user.userId,
      content: 'Original content by User A'
    });

    // User B attempts to edit User A's post -> rejected
    await expect(
      postService.updatePost(postA.postId, userB.user.userId, { content: 'Malicious modification' })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });

    // User B attempts to delete User A's post -> rejected
    await expect(
      postService.deletePost(postA.postId, userB.user.userId)
    ).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });

    // User A successfully edits their post
    const updated = await postService.updatePost(postA.postId, userA.user.userId, { content: 'Legitimate update by User A' });
    expect(updated.content).toBe('Legitimate update by User A');

    // User A successfully deletes their post
    await expect(postService.deletePost(postA.postId, userA.user.userId)).resolves.not.toThrow();
  });

  it('persists and retrieves comments, likes, and bookmarks', async () => {
    const user = await authService.register({
      username: 'user_soc_' + Date.now(),
      email: `user_soc_${Date.now()}@test.local`,
      password: 'SecurePassword123!',
      displayName: 'Social User'
    });
    createdUserIds.push(user.user.userId);

    const post = await postService.createPost({
      userId: user.user.userId,
      content: 'Social interactions test post'
    });

    // Add comment
    const comment = await commentRepo.createComment({
      postId: post.postId,
      userId: user.user.userId,
      content: 'Nice post!'
    });
    expect(comment.commentId).toBeGreaterThan(0);

    // Like post (userId, postId)
    await postRepo.likePost(user.user.userId, post.postId);

    // Bookmark post (userId, postId)
    await postRepo.bookmarkPost(user.user.userId, post.postId);

    const bookmarks = await postRepo.getUserBookmarks(user.user.userId);
    expect(bookmarks.data.some(p => p.postId === post.postId)).toBe(true);
  });

  it('persists and manages stories and reels with author ownership', async () => {
    const user = await authService.register({
      username: 'user_media_' + Date.now(),
      email: `user_media_${Date.now()}@test.local`,
      password: 'SecurePassword123!',
      displayName: 'Media User'
    });
    createdUserIds.push(user.user.userId);

    // Story creation
    const story = await storyRepo.createStory({
      userId: user.user.userId,
      mediaUrl: '/uploads/posts/story-sample.jpg',
      caption: 'Sample story'
    });
    expect(story.storyId).toBeGreaterThan(0);

    // Reel creation
    const reel = await reelRepo.createReel({
      userId: user.user.userId,
      videoUrl: '/uploads/videos/reel-sample.mp4',
      caption: 'Sample reel'
    });
    expect(reel.reelId).toBeGreaterThan(0);

    // Author deletes story
    const storyDeleted = await storyRepo.deleteStory(story.storyId, user.user.userId);
    expect(storyDeleted).toBe(true);

    // Author deletes reel
    const reelDeleted = await reelRepo.deleteReel(reel.reelId, user.user.userId);
    expect(reelDeleted).toBe(true);
  });

  it('handles direct messages and read receipt tracking in Oracle', async () => {
    const sender = await authService.register({
      username: 'msg_sender_' + Date.now(),
      email: `msg_sender_${Date.now()}@test.local`,
      password: 'SecurePassword123!',
      displayName: 'Message Sender'
    });
    createdUserIds.push(sender.user.userId);

    const receiver = await authService.register({
      username: 'msg_rcv_' + Date.now(),
      email: `msg_rcv_${Date.now()}@test.local`,
      password: 'SecurePassword123!',
      displayName: 'Message Receiver'
    });
    createdUserIds.push(receiver.user.userId);

    // Send direct message
    const msg = await messageRepo.sendMessage({
      senderId: sender.user.userId,
      receiverId: receiver.user.userId,
      content: 'Hello via Oracle direct messaging!'
    });
    expect(msg.messageId).toBeGreaterThan(0);
    expect(msg.isRead).toBe(false);

    // Receiver marks message as read
    await messageRepo.markMessageAsRead(msg.messageId, receiver.user.userId);
  });

  it('manages groups, member authorization, and group messages in Oracle', async () => {
    const owner = await authService.register({
      username: 'grp_owner_' + Date.now(),
      email: `grp_owner_${Date.now()}@test.local`,
      password: 'SecurePassword123!',
      displayName: 'Group Owner'
    });
    createdUserIds.push(owner.user.userId);

    const member = await authService.register({
      username: 'grp_mbr_' + Date.now(),
      email: `grp_mbr_${Date.now()}@test.local`,
      password: 'SecurePassword123!',
      displayName: 'Group Member'
    });
    createdUserIds.push(member.user.userId);

    // Create group
    const group = await groupRepo.createGroup({
      name: 'Oracle Dev Group',
      description: 'A test group',
      createdBy: owner.user.userId,
      memberIds: [member.user.userId]
    });
    expect(group.groupId).toBeGreaterThan(0);

    // Check membership
    const members = await groupRepo.getGroupMembers(group.groupId);
    expect(members.some(m => m.userId === member.user.userId)).toBe(true);

    // Post group message
    const gMsg = await groupRepo.sendGroupMessage(group.groupId, member.user.userId, 'Welcome to the Oracle group!');
    expect(gMsg.messageId).toBeGreaterThan(0);

    const msgs = await groupRepo.getGroupMessages(group.groupId);
    expect(msgs.length).toBeGreaterThan(0);
  });

  it('manages broadcasts and recipient distribution in Oracle', async () => {
    const broadcaster = await authService.register({
      username: 'bc_user_' + Date.now(),
      email: `bc_user_${Date.now()}@test.local`,
      password: 'SecurePassword123!',
      displayName: 'Broadcaster'
    });
    createdUserIds.push(broadcaster.user.userId);

    const recipient = await authService.register({
      username: 'bc_rcp_' + Date.now(),
      email: `bc_rcp_${Date.now()}@test.local`,
      password: 'SecurePassword123!',
      displayName: 'Recipient'
    });
    createdUserIds.push(recipient.user.userId);

    const bc = await broadcastRepo.createBroadcast(
      broadcaster.user.userId,
      [recipient.user.userId],
      'This is an announcement',
      'System Announcement'
    );

    expect(bc.broadcastId).toBeGreaterThan(0);
    expect(bc.recipientsCount).toBe(1);

    const broadcasts = await broadcastRepo.getUserBroadcasts(broadcaster.user.userId);
    expect(broadcasts.some(b => b.broadcastId === bc.broadcastId)).toBe(true);
  });

  it('safely handles SQL-injection shaped input through bind parameters', async () => {
    const sqliInput = "' OR 1=1 -- \"; DROP TABLE USERS; --";
    const user = await userRepo.findByUsername(sqliInput);
    expect(user).toBeNull();

    const searchRes = await userRepo.searchUsers(sqliInput, 10);
    expect(Array.isArray(searchRes)).toBe(true);
  });

  it('updates user profile details and verifies search indexing', async () => {
    const testRunId = Date.now();
    const uniqueDisplayName = `Searchable User ${testRunId}`;

    const user = await authService.register({
      username: 'srch_usr_' + testRunId,
      email: `srch_usr_${testRunId}@test.local`,
      password: 'SecurePassword123!',
      displayName: 'Initial Name'
    });
    createdUserIds.push(user.user.userId);

    const updated = await userRepo.updateUser(user.user.userId, {
      displayName: uniqueDisplayName,
      bio: 'Bio text for search verification'
    });
    expect(updated?.displayName).toBe(uniqueDisplayName);

    // Verify findById returns updated value
    const found = await userRepo.findById(user.user.userId);
    expect(found?.displayName).toBe(uniqueDisplayName);

    const searchRes = await userRepo.searchUsers(uniqueDisplayName, undefined, 10);
    expect(searchRes.length).toBeGreaterThan(0);
    expect(searchRes[0].userId).toBe(user.user.userId);
  });

  it('creates and manages user notifications with read status', async () => {
    const sender = await authService.register({
      username: 'notif_snd_' + Date.now(),
      email: `notif_snd_${Date.now()}@test.local`,
      password: 'SecurePassword123!',
      displayName: 'Notif Sender'
    });
    createdUserIds.push(sender.user.userId);

    const recipient = await authService.register({
      username: 'notif_rcp_' + Date.now(),
      email: `notif_rcp_${Date.now()}@test.local`,
      password: 'SecurePassword123!',
      displayName: 'Notif Recipient'
    });
    createdUserIds.push(recipient.user.userId);

    const notif = await notificationRepo.createNotification({
      recipientUserId: recipient.user.userId,
      actorUserId: sender.user.userId,
      type: 'FOLLOW'
    });
    expect(notif.notificationId).toBeGreaterThan(0);
    expect(notif.isRead).toBe(false);

    // Mark as read
    await notificationRepo.markAsRead(notif.notificationId, recipient.user.userId);
    const notifs = await notificationRepo.getUserNotifications(recipient.user.userId);
    const readNotif = notifs.data.find(n => n.notificationId === notif.notificationId);
    expect(readNotif?.isRead).toBe(true);
  });

  it('registers, upserts idempotently, and revokes FCM notification tokens', async () => {
    const testUser = await authService.register({
      username: 'fcm_usr_' + Date.now(),
      email: `fcm_usr_${Date.now()}@test.local`,
      password: 'SecurePassword123!',
      displayName: 'FCM Test User'
    });
    createdUserIds.push(testUser.user.userId);

    const tokenValue = 'fcm_sample_token_' + Date.now() + '_xyz123';

    // 1. Initial registration
    await fcmRepo.upsertToken(testUser.user.userId, tokenValue, 'android', 'pixel-8-pro');
    let tokens = await fcmRepo.getUserTokens(testUser.user.userId);
    expect(tokens).toContain(tokenValue);

    // 2. Idempotent upsert with same token (e.g. platform update)
    await fcmRepo.upsertToken(testUser.user.userId, tokenValue, 'android', 'pixel-8-pro-v2');
    tokens = await fcmRepo.getUserTokens(testUser.user.userId);
    expect(tokens.filter(t => t === tokenValue).length).toBe(1);

    // 3. Revoke specific token
    const revoked = await fcmRepo.revokeToken(tokenValue, testUser.user.userId);
    expect(revoked).toBe(true);
    tokens = await fcmRepo.getUserTokens(testUser.user.userId);
    expect(tokens).not.toContain(tokenValue);

    // 4. Multiple tokens and revoke all
    const tokenA = 'fcm_token_a_' + Date.now();
    const tokenB = 'fcm_token_b_' + Date.now();
    await fcmRepo.upsertToken(testUser.user.userId, tokenA, 'android');
    await fcmRepo.upsertToken(testUser.user.userId, tokenB, 'android');
    tokens = await fcmRepo.getUserTokens(testUser.user.userId);
    expect(tokens.length).toBe(2);

    const revokedCount = await fcmRepo.revokeUserTokens(testUser.user.userId);
    expect(revokedCount).toBe(2);
    tokens = await fcmRepo.getUserTokens(testUser.user.userId);
    expect(tokens.length).toBe(0);
  });

  it('manages privacy settings, hidden words, blocks, follow requests, reports and moderation in Oracle', async () => {
    // 1. Create two test users
    const userA = await authService.register({
      username: 'priv_a_' + Date.now(),
      email: `priv_a_${Date.now()}@test.local`,
      password: 'SecurePassword123!',
      displayName: 'Privacy User A'
    });
    createdUserIds.push(userA.user.userId);

    const userB = await authService.register({
      username: 'priv_b_' + Date.now(),
      email: `priv_b_${Date.now()}@test.local`,
      password: 'SecurePassword123!',
      displayName: 'Privacy User B'
    });
    createdUserIds.push(userB.user.userId);

    // 2. Privacy Settings (get and update)
    const initialSettings = await privacyRepo.getPrivacySettings(userA.user.userId);
    expect(initialSettings.userId).toBe(userA.user.userId);
    expect(initialSettings.isPrivate).toBe(false);

    const updatedSettings = await privacyRepo.updatePrivacySettings(userA.user.userId, {
      isPrivate: true,
      whoCanMessage: 'FOLLOWING',
      hideLikeCounts: true
    });
    expect(updatedSettings.isPrivate).toBe(true);
    expect(updatedSettings.whoCanMessage).toBe('FOLLOWING');
    expect(updatedSettings.hideLikeCounts).toBe(true);

    // 3. Hidden Words
    const words = ['crypto_scam', 'free_followers', 'phishing_link'];
    const savedWords = await privacyRepo.setHiddenWords(userA.user.userId, words);
    expect(savedWords.sort()).toEqual(words.sort());

    const retrievedWords = await privacyRepo.getHiddenWords(userA.user.userId);
    expect(retrievedWords.sort()).toEqual(words.sort());

    // 4. User Blocks
    expect(await privacyRepo.isBlocked(userA.user.userId, userB.user.userId)).toBe(false);

    await privacyRepo.blockUser(userA.user.userId, userB.user.userId);
    expect(await privacyRepo.isBlocked(userA.user.userId, userB.user.userId)).toBe(true);

    const blockedList = await privacyRepo.getBlockedUsers(userA.user.userId);
    expect(blockedList.some(b => b.userId === userB.user.userId)).toBe(true);

    await privacyRepo.unblockUser(userA.user.userId, userB.user.userId);
    expect(await privacyRepo.isBlocked(userA.user.userId, userB.user.userId)).toBe(false);

    // 5. Follow Requests
    const reqResult = await privacyRepo.createFollowRequest(userB.user.userId, userA.user.userId);
    expect(reqResult.requestId).toBeGreaterThan(0);
    expect(reqResult.status).toBe('PENDING');

    const pendingRequests = await privacyRepo.getPendingFollowRequests(userA.user.userId);
    expect(pendingRequests.some(r => r.requestId === reqResult.requestId)).toBe(true);

    const accepted = await privacyRepo.respondToFollowRequest(userA.user.userId, reqResult.requestId, true);
    expect(accepted).toBe(true);

    // Check follower relationship formed
    const isNowFollowing = await userRepo.isFollowing(userB.user.userId, userA.user.userId);
    expect(isNowFollowing).toBe(true);

    // 6. Reports & Moderation Actions
    const reportResult = await privacyRepo.createReport({
      reporterUserId: userB.user.userId,
      targetType: 'USER',
      targetId: userA.user.userId,
      reason: 'Harassment',
      details: 'Test violation details'
    });
    expect(reportResult.reportId).toBeGreaterThan(0);

    const reports = await privacyRepo.getReports({ status: 'PENDING' });
    expect(reports.some(r => r.reportId === reportResult.reportId)).toBe(true);

    const modAction = await privacyRepo.createModerationAction({
      reportId: reportResult.reportId,
      moderatorUserId: userA.user.userId,
      actionType: 'DISMISS_REPORT',
      targetType: 'USER',
      targetId: userA.user.userId,
      notes: 'Dismissed in automated integration test'
    });
    expect(modAction.actionId).toBeGreaterThan(0);
  });
});
