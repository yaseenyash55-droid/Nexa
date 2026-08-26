import pg from 'pg';
import { executePostgresSql } from '../../db/postgres.pool.js';
import { IUserRepository } from '../types.js';
import { User } from '../../types/index.js';

interface RawUserRow {
  user_id: number;
  username: string;
  email: string;
  password_hash?: string;
  display_name: string;
  bio?: string | null;
  profile_image_url?: string | null;
  cover_image_url?: string | null;
  location?: string | null;
  website_url?: string | null;
  failed_login_attempts?: number;
  first_failed_attempt_at?: Date | string | null;
  lockout_until?: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  followers_count?: number | string;
  following_count?: number | string;
  is_following?: number | boolean;
}

export class PostgresUserRepository implements IUserRepository {
  private mapRowToUser(row: RawUserRow, includeHash = false): User {
    return {
      userId: Number(row.user_id),
      username: row.username,
      email: row.email,
      passwordHash: includeHash ? row.password_hash : undefined,
      displayName: row.display_name,
      bio: row.bio ?? undefined,
      profileImageUrl: row.profile_image_url ?? undefined,
      coverImageUrl: row.cover_image_url ?? undefined,
      location: row.location ?? undefined,
      websiteUrl: row.website_url ?? undefined,
      failedLoginAttempts: Number(row.failed_login_attempts || 0),
      firstFailedAttemptAt: row.first_failed_attempt_at ? new Date(row.first_failed_attempt_at).toISOString() : null,
      lockoutUntil: row.lockout_until ? new Date(row.lockout_until).toISOString() : null,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
      followersCount: Number(row.followers_count || 0),
      followingCount: Number(row.following_count || 0),
      isFollowing: Boolean(row.is_following && Number(row.is_following) > 0)
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
    return this.createUserOnConnection(null, user);
  }

  async createUserOnConnection(conn: pg.PoolClient | null, user: {
    username: string;
    email: string;
    passwordHash: string;
    displayName: string;
    bio?: string;
    location?: string;
    websiteUrl?: string;
  }): Promise<User> {
    const sql = `
      INSERT INTO users (username, email, password_hash, display_name, bio, location, website_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING user_id, username, email, display_name, bio, profile_image_url, cover_image_url,
                location, website_url, failed_login_attempts, first_failed_attempt_at, lockout_until,
                created_at, updated_at
    `;

    const normalizedUsername = user.username.trim().toLowerCase();
    const normalizedEmail = user.email.trim().toLowerCase();

    const params = [
      normalizedUsername,
      normalizedEmail,
      user.passwordHash,
      user.displayName.trim(),
      user.bio || null,
      user.location || null,
      user.websiteUrl || null
    ];

    try {
      let row: RawUserRow;
      if (conn) {
        const res = await conn.query<RawUserRow>(sql, params);
        row = res.rows[0];
      } else {
        const res = await executePostgresSql<RawUserRow>(sql, params);
        row = res.rows[0];
      }

      return this.mapRowToUser(row);
    } catch (err: any) {
      // Map PostgreSQL unique violation code 23505 to 409
      if (err.code === '23505' || (err.message && err.message.includes('unique constraint'))) {
        const constraint = (err.constraint || err.message || '').toLowerCase();
        if (constraint.includes('username')) {
          throw { statusCode: 409, code: 'USERNAME_TAKEN', message: 'Username is already registered' };
        }
        if (constraint.includes('email')) {
          throw { statusCode: 409, code: 'EMAIL_TAKEN', message: 'Email is already registered' };
        }
        throw { statusCode: 409, code: 'DUPLICATE_ENTRY', message: 'A user with this username or email already exists' };
      }
      throw err;
    }
  }

  async findByIdOnConnection(conn: pg.PoolClient, userId: number): Promise<User | null> {
    const sql = `
      SELECT u.user_id, u.username, u.email, u.display_name, u.bio, u.profile_image_url,
             u.cover_image_url, u.location, u.website_url, u.created_at, u.updated_at,
             0 AS followers_count, 0 AS following_count, 0 AS is_following
      FROM users u
      WHERE u.user_id = $1
    `;
    const res = await conn.query<RawUserRow>(sql, [userId]);
    if (!res.rows || res.rows.length === 0) return null;
    return this.mapRowToUser(res.rows[0]);
  }

  async findByUsername(username: string): Promise<User | null> {
    const sql = `
      SELECT u.user_id, u.username, u.email, u.password_hash, u.display_name, u.bio, u.profile_image_url,
             u.cover_image_url, u.location, u.website_url, u.failed_login_attempts, u.first_failed_attempt_at,
             u.lockout_until, u.created_at, u.updated_at,
             (SELECT COUNT(*) FROM followers WHERE following_id = u.user_id) AS followers_count,
             (SELECT COUNT(*) FROM followers WHERE follower_id = u.user_id) AS following_count
      FROM users u
      WHERE LOWER(u.username) = LOWER($1)
    `;
    const res = await executePostgresSql<RawUserRow>(sql, [username]);
    if (!res.rows || res.rows.length === 0) return null;
    return this.mapRowToUser(res.rows[0], true);
  }

  async findByEmail(email: string): Promise<User | null> {
    const sql = `
      SELECT user_id, username, email, password_hash, display_name, bio, profile_image_url,
             cover_image_url, location, website_url, failed_login_attempts, first_failed_attempt_at,
             lockout_until, created_at, updated_at
      FROM users
      WHERE LOWER(email) = LOWER($1)
    `;
    const res = await executePostgresSql<RawUserRow>(sql, [email]);
    if (!res.rows || res.rows.length === 0) return null;
    return this.mapRowToUser(res.rows[0], true);
  }

  async findCredentialById(userId: number): Promise<{ userId: number; passwordHash: string } | null> {
    const res = await executePostgresSql<{ user_id: number; password_hash: string }>(
      'SELECT user_id, password_hash FROM users WHERE user_id = $1',
      [userId]
    );
    if (!res.rows || res.rows.length === 0) return null;
    return { userId: Number(res.rows[0].user_id), passwordHash: res.rows[0].password_hash };
  }

  async updatePasswordHash(userId: number, passwordHash: string): Promise<void> {
    const result = await executePostgresSql(
      `UPDATE users
       SET password_hash = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2`,
      [passwordHash, userId]
    );

    if (result.rowCount !== 1) {
      throw { statusCode: 404, code: 'USER_NOT_FOUND', message: 'User not found' };
    }
  }

  async findById(userId: number, currentUserId?: number): Promise<User | null> {
    const sql = `
      SELECT u.user_id, u.username, u.email, u.display_name, u.bio, u.profile_image_url,
             u.cover_image_url, u.location, u.website_url, u.created_at, u.updated_at,
             (SELECT COUNT(*) FROM followers WHERE following_id = u.user_id) AS followers_count,
             (SELECT COUNT(*) FROM followers WHERE follower_id = u.user_id) AS following_count,
             ${currentUserId ? `(SELECT COUNT(*) FROM followers WHERE follower_id = $2 AND following_id = u.user_id)` : '0'} AS is_following
      FROM users u
      WHERE u.user_id = $1
    `;
    const params: any[] = [userId];
    if (currentUserId) params.push(currentUserId);

    const res = await executePostgresSql<RawUserRow>(sql, params);
    if (!res.rows || res.rows.length === 0) return null;
    return this.mapRowToUser(res.rows[0]);
  }

  async updateUser(userId: number, updates: {
    username?: string;
    displayName?: string;
    bio?: string;
    profileImageUrl?: string;
    coverImageUrl?: string;
    location?: string;
    websiteUrl?: string;
  }): Promise<User> {
    const fields: string[] = [];
    const params: any[] = [userId];
    let paramIndex = 2;

    if (updates.username !== undefined) {
      fields.push(`username = $${paramIndex++}`);
      params.push(updates.username);
    }
    if (updates.displayName !== undefined) {
      fields.push(`display_name = $${paramIndex++}`);
      params.push(updates.displayName);
    }
    if (updates.bio !== undefined) {
      fields.push(`bio = $${paramIndex++}`);
      params.push(updates.bio);
    }
    if (updates.profileImageUrl !== undefined) {
      fields.push(`profile_image_url = $${paramIndex++}`);
      params.push(updates.profileImageUrl);
    }
    if (updates.coverImageUrl !== undefined) {
      fields.push(`cover_image_url = $${paramIndex++}`);
      params.push(updates.coverImageUrl);
    }
    if (updates.location !== undefined) {
      fields.push(`location = $${paramIndex++}`);
      params.push(updates.location);
    }
    if (updates.websiteUrl !== undefined) {
      fields.push(`website_url = $${paramIndex++}`);
      params.push(updates.websiteUrl);
    }
    fields.push('updated_at = CURRENT_TIMESTAMP');

    const sql = `UPDATE users SET ${fields.join(', ')} WHERE user_id = $1`;
    await executePostgresSql(sql, params);

    const updated = await this.findById(userId);
    if (!updated) throw new Error('User not found after update');
    return updated;
  }

  async searchUsers(query: string, currentUserId?: number, limit = 10): Promise<User[]> {
    const trimmed = query.trim();
    const searchPattern = `%${trimmed.toLowerCase()}%`;
    const isNumeric = /^\d+$/.test(trimmed);
    
    const params: any[] = [searchPattern, limit];
    let paramIndex = 3;
    let userIdParamIndex: number | null = null;
    let currentUserIdParamIndex: number | null = null;

    if (isNumeric) {
      userIdParamIndex = paramIndex++;
      params.push(parseInt(trimmed, 10));
    }
    if (currentUserId) {
      currentUserIdParamIndex = paramIndex++;
      params.push(currentUserId);
    }

    const sql = `
      SELECT u.user_id, u.username, u.email, u.display_name, u.bio, u.profile_image_url,
             u.cover_image_url, u.location, u.website_url, u.created_at, u.updated_at,
             (SELECT COUNT(*) FROM followers WHERE following_id = u.user_id) AS followers_count,
             (SELECT COUNT(*) FROM followers WHERE follower_id = u.user_id) AS following_count,
             ${currentUserIdParamIndex ? `(SELECT COUNT(*) FROM followers WHERE follower_id = $${currentUserIdParamIndex} AND following_id = u.user_id)` : '0'} AS is_following
      FROM users u
      WHERE LOWER(u.username) LIKE $1 
         OR LOWER(u.display_name) LIKE $1
         ${userIdParamIndex ? `OR u.user_id = $${userIdParamIndex}` : ''}
      ORDER BY u.user_id ASC
      LIMIT $2
    `;

    const res = await executePostgresSql<RawUserRow>(sql, params);
    return (res.rows || []).map((row) => this.mapRowToUser(row));
  }

  async getSuggestions(currentUserId: number, limit = 5): Promise<User[]> {
    const sql = `
      SELECT u.user_id, u.username, u.email, u.display_name, u.bio, u.profile_image_url,
             u.cover_image_url, u.location, u.website_url, u.created_at, u.updated_at,
             (SELECT COUNT(*) FROM followers WHERE following_id = u.user_id) AS followers_count,
             (SELECT COUNT(*) FROM followers WHERE follower_id = u.user_id) AS following_count,
             0 AS is_following
      FROM users u
      WHERE u.user_id <> $1
        AND u.user_id NOT IN (SELECT following_id FROM followers WHERE follower_id = $1)
      ORDER BY u.created_at DESC
      LIMIT $2
    `;
    const res = await executePostgresSql<RawUserRow>(sql, [currentUserId, limit]);
    return (res.rows || []).map((row) => this.mapRowToUser(row));
  }

  async followUser(followerId: number, followingId: number): Promise<void> {
    if (followerId === followingId) {
      throw new Error('Self-following is not permitted');
    }
    const sql = `
      INSERT INTO followers (follower_id, following_id, created_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (follower_id, following_id) DO NOTHING
    `;
    await executePostgresSql(sql, [followerId, followingId]);
  }

  async unfollowUser(followerId: number, followingId: number): Promise<void> {
    const sql = `DELETE FROM followers WHERE follower_id = $1 AND following_id = $2`;
    await executePostgresSql(sql, [followerId, followingId]);
  }

  async isFollowing(followerId: number, followingId: number): Promise<boolean> {
    const sql = `
      SELECT COUNT(*) AS cnt FROM followers WHERE follower_id = $1 AND following_id = $2
    `;
    const res = await executePostgresSql<{ cnt: number | string }>(sql, [followerId, followingId]);
    return Boolean(res.rows && Number(res.rows[0].cnt) > 0);
  }

  async getFollowers(userId: number, currentUserId?: number): Promise<User[]> {
    const sql = `
      SELECT u.user_id, u.username, u.email, u.display_name, u.bio, u.profile_image_url,
             u.cover_image_url, u.location, u.website_url, u.created_at, u.updated_at,
             (SELECT COUNT(*) FROM followers WHERE following_id = u.user_id) AS followers_count,
             (SELECT COUNT(*) FROM followers WHERE follower_id = u.user_id) AS following_count,
             ${currentUserId ? `(SELECT COUNT(*) FROM followers WHERE follower_id = $2 AND following_id = u.user_id)` : '0'} AS is_following
      FROM followers f
      JOIN users u ON f.follower_id = u.user_id
      WHERE f.following_id = $1
      ORDER BY f.created_at DESC
    `;
    const params: any[] = [userId];
    if (currentUserId) params.push(currentUserId);

    const res = await executePostgresSql<RawUserRow>(sql, params);
    return (res.rows || []).map((row) => this.mapRowToUser(row));
  }

  async getFollowing(userId: number, currentUserId?: number): Promise<User[]> {
    const sql = `
      SELECT u.user_id, u.username, u.email, u.display_name, u.bio, u.profile_image_url,
             u.cover_image_url, u.location, u.website_url, u.created_at, u.updated_at,
             (SELECT COUNT(*) FROM followers WHERE following_id = u.user_id) AS followers_count,
             (SELECT COUNT(*) FROM followers WHERE follower_id = u.user_id) AS following_count,
             ${currentUserId ? `(SELECT COUNT(*) FROM followers WHERE follower_id = $2 AND following_id = u.user_id)` : '0'} AS is_following
      FROM followers f
      JOIN users u ON f.following_id = u.user_id
      WHERE f.follower_id = $1
      ORDER BY f.created_at DESC
    `;
    const params: any[] = [userId];
    if (currentUserId) params.push(currentUserId);

    const res = await executePostgresSql<RawUserRow>(sql, params);
    return (res.rows || []).map((row) => this.mapRowToUser(row));
  }

  async updateLockoutState(
    userId: number,
    failedLoginAttempts: number,
    firstFailedAttemptAt: Date | null,
    lockoutUntil: Date | null
  ): Promise<void> {
    const sql = `
      UPDATE users
      SET failed_login_attempts = $1,
          first_failed_attempt_at = $2,
          lockout_until = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $4
    `;
    await executePostgresSql(sql, [failedLoginAttempts, firstFailedAttemptAt, lockoutUntil, userId]);
  }

  async resetLockoutState(userId: number): Promise<void> {
    const sql = `
      UPDATE users
      SET failed_login_attempts = 0,
          first_failed_attempt_at = NULL,
          lockout_until = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1
    `;
    await executePostgresSql(sql, [userId]);
  }
}
