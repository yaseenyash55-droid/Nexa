import { Index } from '@upstash/vector';
import { env } from '../config/env.js';
import { logger } from './logger.js';

let vectorIndexInstance: Index | null = null;

/**
 * Returns a singleton instance of the Upstash Vector Index.
 */
export function getVectorIndex(): Index | null {
  const url = process.env.UPSTASH_VECTOR_REST_URL || process.env.UPSTASH_VECTOR_URL;
  const token = process.env.UPSTASH_VECTOR_REST_TOKEN || process.env.UPSTASH_VECTOR_TOKEN;

  if (!url || !token) {
    return null;
  }

  if (!vectorIndexInstance) {
    try {
      vectorIndexInstance = new Index({ url, token });
      logger.info({ url }, '[UpstashVector] Initialized vector index client');
    } catch (err) {
      logger.error({ err }, '[UpstashVector] Failed to initialize index client');
      return null;
    }
  }

  return vectorIndexInstance;
}

export interface VectorRecord<T = Record<string, any>> {
  id: string;
  vector: number[];
  metadata?: T;
  data?: string;
}

export interface VectorQueryResult<T = Record<string, any>> {
  id: string;
  score: number;
  vector?: number[];
  metadata?: T;
  data?: string;
}

export const vectorService = {
  /**
   * Upserts a single vector or a batch of vectors into Upstash Vector index.
   */
  async upsert<T extends Record<string, any>>(
    vectors: VectorRecord<T> | VectorRecord<T>[]
  ): Promise<boolean> {
    const index = getVectorIndex();
    if (!index) {
      logger.warn('[UpstashVector] Skipped upsert: Vector credentials not configured');
      return false;
    }

    try {
      if (Array.isArray(vectors)) {
        await index.upsert(vectors);
      } else {
        await index.upsert(vectors);
      }
      return true;
    } catch (err) {
      logger.error({ err }, '[UpstashVector] Upsert operation failed');
      return false;
    }
  },

  /**
   * Performs top-K similarity search against the Upstash Vector index.
   */
  async query<T extends Record<string, any>>(options: {
    vector: number[];
    topK?: number;
    includeVectors?: boolean;
    includeMetadata?: boolean;
    filter?: string;
  }): Promise<VectorQueryResult<T>[]> {
    const index = getVectorIndex();
    if (!index) {
      logger.warn('[UpstashVector] Skipped query: Vector credentials not configured');
      return [];
    }

    try {
      const results = await index.query<T>({
        vector: options.vector,
        topK: options.topK ?? 10,
        includeVectors: options.includeVectors ?? false,
        includeMetadata: options.includeMetadata ?? true,
        filter: options.filter
      });
      return (results as VectorQueryResult<T>[]) || [];
    } catch (err) {
      logger.error({ err }, '[UpstashVector] Query operation failed');
      return [];
    }
  },

  /**
   * Deletes one or more vectors by ID.
   */
  async delete(ids: string | string[]): Promise<boolean> {
    const index = getVectorIndex();
    if (!index) return false;

    try {
      if (Array.isArray(ids)) {
        await index.delete(ids);
      } else {
        await index.delete(ids);
      }
      return true;
    } catch (err) {
      logger.error({ err }, '[UpstashVector] Delete operation failed');
      return false;
    }
  }
};
