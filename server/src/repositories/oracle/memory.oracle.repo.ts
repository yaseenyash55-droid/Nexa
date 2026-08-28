import { executeSql, isOraclePoolInitialized } from '../../db/pool.js';
import { IAiMemoryRepository, AiPreference, AiMemory } from '../../types/ai.types.js';
import { logger } from '../../utils/logger.js';

export class OracleAiMemoryRepository implements IAiMemoryRepository {
  public async getPreferences(userId: number): Promise<AiPreference> {
    if (!isOraclePoolInitialized()) {
      return {
        userId,
        personalizationEnabled: true,
        preferredLanguage: 'English',
        responseLength: 'balanced',
        writingTone: 'friendly',
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    const selectSql = `
      SELECT
        USER_ID,
        PERSONALIZATION_ENABLED,
        PREFERRED_LANGUAGE,
        RESPONSE_LENGTH,
        WRITING_TONE,
        CREATED_AT,
        UPDATED_AT
      FROM AI_PREFERENCES
      WHERE USER_ID = :userId
    `;

    const res = await executeSql<{
      USER_ID: number;
      PERSONALIZATION_ENABLED: number;
      PREFERRED_LANGUAGE: string;
      RESPONSE_LENGTH: string;
      WRITING_TONE: string;
      CREATED_AT: Date;
      UPDATED_AT: Date;
    }>(selectSql, { userId });

    if (res.rows && res.rows.length > 0) {
      const row = res.rows[0];
      return {
        userId: row.USER_ID,
        personalizationEnabled: row.PERSONALIZATION_ENABLED === 1,
        preferredLanguage: row.PREFERRED_LANGUAGE || 'English',
        responseLength: (row.RESPONSE_LENGTH as any) || 'balanced',
        writingTone: row.WRITING_TONE || 'friendly',
        createdAt: row.CREATED_AT,
        updatedAt: row.UPDATED_AT
      };
    }

    // Default preferences if not yet explicitly saved
    const insertSql = `
      INSERT INTO AI_PREFERENCES (
        USER_ID,
        PERSONALIZATION_ENABLED,
        PREFERRED_LANGUAGE,
        RESPONSE_LENGTH,
        WRITING_TONE
      ) VALUES (
        :userId,
        1,
        'English',
        'balanced',
        'friendly'
      )
    `;

    try {
      await executeSql(insertSql, { userId });
    } catch {
      // ignore concurrent insert error
    }

    return {
      userId,
      personalizationEnabled: true,
      preferredLanguage: 'English',
      responseLength: 'balanced',
      writingTone: 'friendly',
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  public async updatePreferences(
    userId: number,
    updates: Partial<AiPreference>
  ): Promise<AiPreference> {
    const current = await this.getPreferences(userId);

    const personalizationEnabled = updates.personalizationEnabled !== undefined
      ? (updates.personalizationEnabled ? 1 : 0)
      : (current.personalizationEnabled ? 1 : 0);
    const preferredLanguage = updates.preferredLanguage ?? current.preferredLanguage;
    const responseLength = updates.responseLength ?? current.responseLength;
    const writingTone = updates.writingTone ?? current.writingTone;

    if (isOraclePoolInitialized()) {
      const updateSql = `
        MERGE INTO AI_PREFERENCES target
        USING (SELECT :userId AS USER_ID FROM DUAL) src
        ON (target.USER_ID = src.USER_ID)
        WHEN MATCHED THEN
          UPDATE SET
            PERSONALIZATION_ENABLED = :personalizationEnabled,
            PREFERRED_LANGUAGE = :preferredLanguage,
            RESPONSE_LENGTH = :responseLength,
            WRITING_TONE = :writingTone,
            UPDATED_AT = SYSTIMESTAMP
        WHEN NOT MATCHED THEN
          INSERT (
            USER_ID,
            PERSONALIZATION_ENABLED,
            PREFERRED_LANGUAGE,
            RESPONSE_LENGTH,
            WRITING_TONE
          ) VALUES (
            :userId,
            :personalizationEnabled,
            :preferredLanguage,
            :responseLength,
            :writingTone
          )
      `;

      await executeSql(updateSql, {
        userId,
        personalizationEnabled,
        preferredLanguage,
        responseLength,
        writingTone
      });
    }

    return {
      userId,
      personalizationEnabled: personalizationEnabled === 1,
      preferredLanguage,
      responseLength,
      writingTone,
      createdAt: current.createdAt,
      updatedAt: new Date()
    };
  }

  public async getMemories(userId: number): Promise<AiMemory[]> {
    if (!isOraclePoolInitialized()) {
      return [];
    }

    const sql = `
      SELECT
        MEMORY_ID,
        USER_ID,
        KEY_NAME,
        CONTENT,
        CATEGORY,
        CREATED_AT,
        UPDATED_AT
      FROM AI_MEMORIES
      WHERE USER_ID = :userId
      ORDER BY CREATED_AT DESC
    `;

    const res = await executeSql<{
      MEMORY_ID: number;
      USER_ID: number;
      KEY_NAME: string;
      CONTENT: string;
      CATEGORY: string;
      CREATED_AT: Date;
      UPDATED_AT: Date;
    }>(sql, { userId });

    if (!res.rows) return [];

    return res.rows.map(row => ({
      memoryId: row.MEMORY_ID,
      userId: row.USER_ID,
      keyName: row.KEY_NAME,
      content: row.CONTENT,
      category: row.CATEGORY,
      createdAt: row.CREATED_AT,
      updatedAt: row.UPDATED_AT
    }));
  }

  public async getMemoryById(memoryId: number, userId: number): Promise<AiMemory | null> {
    if (!isOraclePoolInitialized()) {
      return null;
    }

    const sql = `
      SELECT
        MEMORY_ID,
        USER_ID,
        KEY_NAME,
        CONTENT,
        CATEGORY,
        CREATED_AT,
        UPDATED_AT
      FROM AI_MEMORIES
      WHERE MEMORY_ID = :memoryId AND USER_ID = :userId
    `;

    const res = await executeSql<{
      MEMORY_ID: number;
      USER_ID: number;
      KEY_NAME: string;
      CONTENT: string;
      CATEGORY: string;
      CREATED_AT: Date;
      UPDATED_AT: Date;
    }>(sql, { memoryId, userId });

    if (!res.rows || res.rows.length === 0) {
      return null;
    }

    const row = res.rows[0];
    return {
      memoryId: row.MEMORY_ID,
      userId: row.USER_ID,
      keyName: row.KEY_NAME,
      content: row.CONTENT,
      category: row.CATEGORY,
      createdAt: row.CREATED_AT,
      updatedAt: row.UPDATED_AT
    };
  }

  public async createMemory(
    userId: number,
    keyName: string,
    content: string,
    category = 'general'
  ): Promise<AiMemory> {
    if (!isOraclePoolInitialized()) {
      return {
        memoryId: Date.now(),
        userId,
        keyName,
        content,
        category,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    const sql = `
      INSERT INTO AI_MEMORIES (
        USER_ID,
        KEY_NAME,
        CONTENT,
        CATEGORY
      ) VALUES (
        :userId,
        :keyName,
        :content,
        :category
      ) RETURNING MEMORY_ID, CREATED_AT, UPDATED_AT INTO :outMemoryId, :outCreatedAt, :outUpdatedAt
    `;

    const binds: any = {
      userId,
      keyName,
      content,
      category,
      outMemoryId: { dir: 3003 /* BIND_OUT */, type: 2002 /* NUMBER */ },
      outCreatedAt: { dir: 3003, type: 2005 /* TIMESTAMP */ },
      outUpdatedAt: { dir: 3003, type: 2005 /* TIMESTAMP */ }
    };

    const res = await executeSql(sql, binds);
    const outMemoryId = res.outBinds?.outMemoryId?.[0] ?? Date.now();
    const outCreatedAt = res.outBinds?.outCreatedAt?.[0] ?? new Date();
    const outUpdatedAt = res.outBinds?.outUpdatedAt?.[0] ?? new Date();

    return {
      memoryId: outMemoryId,
      userId,
      keyName,
      content,
      category,
      createdAt: outCreatedAt,
      updatedAt: outUpdatedAt
    };
  }

  public async deleteMemory(memoryId: number, userId: number): Promise<boolean> {
    if (!isOraclePoolInitialized()) {
      return true;
    }

    const sql = `
      DELETE FROM AI_MEMORIES
      WHERE MEMORY_ID = :memoryId AND USER_ID = :userId
    `;

    const res = await executeSql(sql, { memoryId, userId });
    return (res.rowsAffected ?? 0) > 0;
  }

  public async clearAllMemories(userId: number): Promise<number> {
    if (!isOraclePoolInitialized()) {
      return 0;
    }

    const sql = `
      DELETE FROM AI_MEMORIES
      WHERE USER_ID = :userId
    `;

    const res = await executeSql(sql, { userId });
    return res.rowsAffected ?? 0;
  }
}
