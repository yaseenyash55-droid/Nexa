import { getEmbeddingProvider } from '../providers/factory.js';
import { EmbedResult } from '../../types/ai.types.js';
import { logger } from '../../utils/logger.js';

export class AIEmbeddingService {
  /**
   * Generates a vector embedding for the supplied text using the configured provider.
   */
  public async getEmbedding(text: string): Promise<number[]> {
    const provider = getEmbeddingProvider();
    if (!provider.isAvailable()) {
      throw new Error('AI_PROVIDER_UNAVAILABLE');
    }

    const cleanText = text.trim();
    if (!cleanText) {
      throw new Error('Cannot embed empty text');
    }

    try {
      const res: EmbedResult = await provider.embed(cleanText);
      return res.embedding;
    } catch (err: any) {
      logger.error({ err: err?.message || err }, 'AIEmbeddingService embedding calculation failed');
      throw err;
    }
  }

  /**
   * Calculates cosine similarity between two numeric vectors.
   */
  public cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
    if (vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

export const aiEmbeddingService = new AIEmbeddingService();
