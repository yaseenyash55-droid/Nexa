import oracledb from 'oracledb';
import { executeSql } from '../../db/pool.js';
import { IUserRepository } from '../types.js';
import { User } from '../../types/index.js';

interface RawUserRow {
  USER_ID: number;
  USERNAME: string;
  EMAIL: string;
  PASSWORD_HASH?: string;
  DISPLAY_NAME: string;
  BIO?: string | null;
  PROFILE_IMAGE_URL?: string | null;
  COVER_IMAGE_URL?: string | null;
  LOCATION?: string | null;
  WEBSITE_URL?: string | null;
  CREATED_AT: Date;
  UPDATED_AT: Date;
  FOLLOWERS_COUNT?: number;
  FOLLOWING_COUNT?: number;
  IS_FOLLOWING?: number;
}

export class OracleUserRepository implements IUserRepository {
  private mapRowToUser(row: RawUserRow, includeHash = false): User {
    return {
      userId: row.USER_ID,
      username: row.USERNAME,
      email: row.EMAIL,
      passwordHash: includeHash ? row.PASSWORD_HASH : undefined,
      displayName: row.DISPLAY_NAME,
      bio: row.BIO,
      profileImageUrl: row.PROFILE_IMAGE_URL,
      coverImageUrl: row.COVER_IMAGE_URL,
      location: row.LOCATION,
      websiteUrl: row.WEBSITE_URL,
      createdAt: row.CREATED_AT ? row.CREATED_AT.toISOString() : new Date().toISOString(),
      updatedAt: row.UPDATED_AT ? row.UPDATED_AT.toISOString() : new Date().toISOString(),
      followersCount: Number(row.FOLLOWERS_COUNT || 0),
      followingCount: Number(row.FOLLOWING_COUNT || 0),
      isFollowing: Boolean(row.IS_FOLLOWING && row.IS_FOLLOWING > 0)
    };
  }

  async createUser(user: {
    username: string;
    email: string;
    passwordHash: string;
    displayName: string;
    bio?: string;
    location?: string;
    websiteUrl?: string;
  }): Promise<User> {
    const sql = `
      INSERT INTO USERS (USERNAME, EMAIL, PASSWORD_HASH, DISPLAY_NAME, BIO, LOCATION, WEBSITE_URL)
      VALUES (:username, :email, :passwordHash, :displayName, :bio, :location, :websiteUrl)
      RETURNING USER_ID, CREATED_AT, UPDATED_AT INTO :userId, :createdAt, :updatedAt
    `;

    const binds = {
      username: user.username.toLowerCase().trim(),
      email: user.email.toLowerCase().trim(),
      passwordHash: user.passwordHash,
      displayName: user.displayName.trim(),
      bio: user.bio || null,
      location: user.location || null,
      websiteUrl: user.websiteUrl || null,
      userId: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
      createdAt: { type: oracledb.DATE, dir: oracledb.BIND_OUT },
      updatedAt: { type: oracledb.DATE, dir: oracledb.BIND_OUT }
    };

    const res = await executeSql<never>(sql, binds);
    const outBinds = res.outBinds as any;

    return {
      userId: outBinds.userId[0],
      username: user.username.toLowerCase().trim(),
      email: user.email.toLowerCase().trim(),
      displayName: user.displayName.trim(),
      bio: user.bio || null,
      location: user.location || null,
      websiteUrl: user.websiteUrl || null,
      createdAt: outBinds.createdAt[0].toISOString(),
      updatedAt: outBinds.updatedAt[0].toISOString(),
      followersCount: 0,
      followingCount: 0,
      isFollowing: false
    };
  }

  async findByUsername(username: string): Promise<User | null> {
    const sql = `
      SELECT USER_ID, USERNAME, EMAIL, PASSWORD_HASH, DISPLAY_NAME, BIO, PROFILE_IMAGE_URL,
             COVER_IMAGE_URL, LOCATION, WEBSITE_URL, CREATED_AT, UPDATED_AT,
             (SELECT COUNT(*) FROM FOLLOWERS WHERE FOLLOWING_ID = u.USER_ID) AS FOLLOWERS_COUNT,
             (SELECT COUNT(*) FROM FOLLOWERS WHERE FOLLOWER_ID = u.USER_ID) AS FOLLOWING_COUNT
      FROM USERS u
      WHERE LOWER(USERNAME) = LOWER(:username)
    `;
    const res = await executeSql<RawUserRow>(sql, { username });
    if (!res.rows || res.rows.length === 0) return null;
    return this.mapRowToUser(res.rows[0], true);
  }

  async findByEmail(email: string): Promise<User | null> {
    const sql = `
      SELECT USER_ID, USERNAME, EMAIL, PASSWORD_HASH, DISPLAY_NAME, BIO, PROFILE_IMAGE_URL,
             COVER_IMAGE_URL, LOCATION, WEBSITE_URL, CREATED_AT, UPDATED_AT
      FROM USERS
      WHERE LOWER(EMAIL) = LOWER(:email)
    `;
    const res = await executeSql<RawUserRow>(sql, { email });
    if (!res.rows || res.rows.length === 0) return null;
    return this.mapRowToUser(res.rows[0], true);
  }

  async findCredentialById(userId: number): Promise<{ userId: number; passwordHash: string } | null> {
    const res = await executeSql<{ USER_ID: number; PASSWORD_HASH: string }>(
      'SELECT USER_ID, PASSWORD_HASH FROM USERS WHERE USER_ID = :userId',
      { userId }
    );
    if (!res.rows || res.rows.length === 0) return null;
    return { userId: res.rows[0].USER_ID, passwordHash: res.rows[0].PASSWORD_HASH };
  }

  async findById(userId: number, currentUserId?: number): Promise<User | null> {
    const sql = `
      SELECT u.USER_ID, u.USERNAME, u.EMAIL, u.DISPLAY_NAME, u.BIO, u.PROFILE_IMAGE_URL,
             u.COVER_IMAGE_URL, u.LOCATION, u.WEBSITE_URL, u.CREATED_AT, u.UPDATED_AT,
             (SELECT COUNT(*) FROM FOLLOWERS WHERE FOLLOWING_ID = u.USER_ID) AS FOLLOWERS_COUNT,
             (SELECT COUNT(*) FROM FOLLOWERS WHERE FOLLOWER_ID = u.USER_ID) AS FOLLOWING_COUNT,
             ${currentUserId ? `(SELECT COUNT(*) FROM FOLLOWERS WHERE FOLLOWER_ID = :currentUserId AND FOLLOWING_ID = u.USER_ID)` : '0'} AS IS_FOLLOWING
      FROM USERS u
      WHERE u.USER_ID = :userId
    `;
    const binds: Record<string, any> = { userId };
    if (currentUserId) binds.currentUserId = currentUserId;

    const res = await executeSql<RawUserRow>(sql, binds);
    if (!res.rows || res.rows.length === 0) return null;
    return this.mapRowToUser(res.rows[0]);
  }

  async updateUser(userId: number, updates: {
    displayName?: string;
    bio?: string;
    profileImageUrl?: string;
    coverImageUrl?: string;
    location?: string;
    websiteUrl?: string;
  }): Promise<User> {
    const fields: string[] = [];
    const binds: Record<string, any> = { userId };

    if (updates.displayName !== undefined) {
      fields.push('DISPLAY_NAME = :displayName');
      binds.displayName = updates.displayName;
    }
    if (updates.bio !== undefined) {
      fields.push('BIO = :bio');
      binds.bio = updates.bio;
    }
    if (updates.profileImageUrl !== undefined) {
      fields.push('PROFILE_IMAGE_URL = :profileImageUrl');
      binds.profileImageUrl = updates.profileImageUrl;
    }
    if (updates.coverImageUrl !== undefined) {
      fields.push('COVER_IMAGE_URL = :coverImageUrl');
      binds.coverImageUrl = updates.coverImageUrl;
    }
    if (updates.location !== undefined) {
      fields.push('LOCATION = :location');
      binds.location = updates.location;
    }
    if (updates.websiteUrl !== undefined) {
      fields.push('WEBSITE_URL = :websiteUrl');
      binds.websiteUrl = updates.websiteUrl;
    }
    fields.push('UPDATED_AT = SYSTIMESTAMP');

    const sql = `UPDATE USERS SET ${fields.join(', ')} WHERE USER_ID = :userId`;
    await executeSql(sql, binds);

    const updated = await this.findById(userId);
    if (!updated) throw new Error('User not found after update');
    return updated;
  }

  async searchUsers(query: string, currentUserId?: number, limit = 10): Promise<User[]> {
    const searchPattern = `%${query.toLowerCase().trim()}%`;
    const sql = `
      SELECT u.USER_ID, u.USERNAME, u.EMAIL, u.DISPLAY_NAME, u.BIO, u.PROFILE_IMAGE_URL,
             u.COVER_IMAGE_URL, u.LOCATION, u.WEBSITE_URL, u.CREATED_AT, u.UPDATED_AT,
             (SELECT COUNT(*) FROM FOLLOWERS WHERE FOLLOWING_ID = u.USER_ID) AS FOLLOWERS_COUNT,
             (SELECT COUNT(*) FROM FOLLOWERS WHERE FOLLOWER_ID = u.USER_ID) AS FOLLOWING_COUNT,
             ${currentUserId ? `(SELECT COUNT(*) FROM FOLLOWERS WHERE FOLLOWER_ID = :currentUserId AND FOLLOWING_ID = u.USER_ID)` : '0'} AS IS_FOLLOWING
      FROM USERS u
      WHERE LOWER(u.USERNAME) LIKE :searchPattern OR LOWER(u.DISPLAY_NAME) LIKE :searchPattern
      ORDER BY u.USER_ID ASC
      FETCH NEXT :limit ROWS ONLY
    `;
    const binds: Record<string, any> = { searchPattern, limit };
    if (currentUserId) binds.currentUserId = currentUserId;

    const res = await executeSql<RawUserRow>(sql, binds);
    return (res.rows || []).map((row: RawUserRow) => this.mapRowToUser(row));
  }

  async getSuggestions(currentUserId: number, limit = 5): Promise<User[]> {
    const sql = `
      SELECT u.USER_ID, u.USERNAME, u.EMAIL, u.DISPLAY_NAME, u.BIO, u.PROFILE_IMAGE_URL,
             u.COVER_IMAGE_URL, u.LOCATION, u.WEBSITE_URL, u.CREATED_AT, u.UPDATED_AT,
             (SELECT COUNT(*) FROM FOLLOWERS WHERE FOLLOWING_ID = u.USER_ID) AS FOLLOWERS_COUNT,
             (SELECT COUNT(*) FROM FOLLOWERS WHERE FOLLOWER_ID = u.USER_ID) AS FOLLOWING_COUNT,
             0 AS IS_FOLLOWING
      FROM USERS u
      WHERE u.USER_ID <> :currentUserId
        AND u.USER_ID NOT IN (SELECT FOLLOWING_ID FROM FOLLOWERS WHERE FOLLOWER_ID = :currentUserId)
      ORDER BY u.CREATED_AT DESC
      FETCH NEXT :limit ROWS ONLY
    `;
    const res = await executeSql<RawUserRow>(sql, { currentUserId, limit });
    return (res.rows || []).map((row: RawUserRow) => this.mapRowToUser(row));
  }

  async followUser(followerId: number, followingId: number): Promise<void> {
    if (followerId === followingId) {
      throw new Error('Self-following is not permitted');
    }
    // Idempotent MERGE statement in Oracle
    const sql = `
      MERGE INTO FOLLOWERS f
      USING (SELECT :followerId AS FOLLOWER_ID, :followingId AS FOLLOWING_ID FROM DUAL) src
      ON (f.FOLLOWER_ID = src.FOLLOWER_ID AND f.FOLLOWING_ID = src.FOLLOWING_ID)
      WHEN NOT MATCHED THEN
        INSERT (FOLLOWER_ID, FOLLOWING_ID, CREATED_AT)
        VALUES (src.FOLLOWER_ID, src.FOLLOWING_ID, SYSTIMESTAMP)
    `;
    await executeSql(sql, { followerId, followingId });
  }

  async unfollowUser(followerId: number, followingId: number): Promise<void> {
    const sql = `
      DELETE FROM FOLLOWERS WHERE FOLLOWER_ID = :followerId AND FOLLOWING_ID = :followingId
    `;
    await executeSql(sql, { followerId, followingId });
  }

  async isFollowing(followerId: number, followingId: number): Promise<boolean> {
    const sql = `
      SELECT COUNT(*) AS CNT FROM FOLLOWERS WHERE FOLLOWER_ID = :followerId AND FOLLOWING_ID = :followingId
    `;
    const res = await executeSql<{ CNT: number }>(sql, { followerId, followingId });
    return Boolean(res.rows && res.rows[0].CNT > 0);
  }

  async getFollowers(userId: number, currentUserId?: number): Promise<User[]> {
    const sql = `
      SELECT u.USER_ID, u.USERNAME, u.EMAIL, u.DISPLAY_NAME, u.BIO, u.PROFILE_IMAGE_URL,
             u.COVER_IMAGE_URL, u.LOCATION, u.WEBSITE_URL, u.CREATED_AT, u.UPDATED_AT,
             (SELECT COUNT(*) FROM FOLLOWERS WHERE FOLLOWING_ID = u.USER_ID) AS FOLLOWERS_COUNT,
             (SELECT COUNT(*) FROM FOLLOWERS WHERE FOLLOWER_ID = u.USER_ID) AS FOLLOWING_COUNT,
             ${currentUserId ? `(SELECT COUNT(*) FROM FOLLOWERS WHERE FOLLOWER_ID = :currentUserId AND FOLLOWING_ID = u.USER_ID)` : '0'} AS IS_FOLLOWING
      FROM FOLLOWERS f
      JOIN USERS u ON f.FOLLOWER_ID = u.USER_ID
      WHERE f.FOLLOWING_ID = :userId
      ORDER BY f.CREATED_AT DESC
    `;
    const binds: Record<string, any> = { userId };
    if (currentUserId) binds.currentUserId = currentUserId;

    const res = await executeSql<RawUserRow>(sql, binds);
    return (res.rows || []).map((row: RawUserRow) => this.mapRowToUser(row));
  }

  async getFollowing(userId: number, currentUserId?: number): Promise<User[]> {
    const sql = `
      SELECT u.USER_ID, u.USERNAME, u.EMAIL, u.DISPLAY_NAME, u.BIO, u.PROFILE_IMAGE_URL,
             u.COVER_IMAGE_URL, u.LOCATION, u.WEBSITE_URL, u.CREATED_AT, u.UPDATED_AT,
             (SELECT COUNT(*) FROM FOLLOWERS WHERE FOLLOWING_ID = u.USER_ID) AS FOLLOWERS_COUNT,
             (SELECT COUNT(*) FROM FOLLOWERS WHERE FOLLOWER_ID = u.USER_ID) AS FOLLOWING_COUNT,
             ${currentUserId ? `(SELECT COUNT(*) FROM FOLLOWERS WHERE FOLLOWER_ID = :currentUserId AND FOLLOWING_ID = u.USER_ID)` : '0'} AS IS_FOLLOWING
      FROM FOLLOWERS f
      JOIN USERS u ON f.FOLLOWING_ID = u.USER_ID
      WHERE f.FOLLOWER_ID = :userId
      ORDER BY f.CREATED_AT DESC
    `;
    const binds: Record<string, any> = { userId };
    if (currentUserId) binds.currentUserId = currentUserId;

    const res = await executeSql<RawUserRow>(sql, binds);
    return (res.rows || []).map((row: RawUserRow) => this.mapRowToUser(row));
  }
}
