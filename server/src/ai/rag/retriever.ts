import { getRagDocumentRepository } from '../../repositories/factory.js';
import { aiEmbeddingService } from './embedding.service.js';
import { RagSearchResult } from '../../types/ai.types.js';
import { logger } from '../../utils/logger.js';

export interface RetrievalOptions {
  topK?: number;
  minSimilarity?: number;
}

export class RAGRetriever {
  /**
   * Retrieves the most semantically relevant documentation chunks for a user query.
   */
  public async retrieve(query: string, options: RetrievalOptions = {}): Promise<RagSearchResult[]> {
    const topK = options.topK || 3;
    const minSimilarity = options.minSimilarity || 0.25;

    const cleanQuery = query.trim();
    if (!cleanQuery) return [];

    let queryEmbedding: number[] = [];
    try {
      queryEmbedding = await aiEmbeddingService.getEmbedding(cleanQuery);
    } catch (err: any) {
      logger.warn({ err: err?.message || err }, 'Failed to compute query embedding for RAG retrieval; falling back to lexical search');
    }

    let allChunks: any[] = [];
    try {
      const ragRepo = getRagDocumentRepository();
      allChunks = await ragRepo.getAllChunksWithEmbeddings();
    } catch (err: any) {
      logger.warn({ err: err?.message || err }, 'Failed to load RAG knowledge chunks from repository');
      return [];
    }

    if (allChunks.length === 0) {
      return [];
    }

    const scoredResults: RagSearchResult[] = [];

    for (const chunk of allChunks) {
      let similarity = 0;

      if (queryEmbedding.length > 0 && chunk.embedding && chunk.embedding.length > 0) {
        similarity = aiEmbeddingService.cosineSimilarity(queryEmbedding, chunk.embedding);
      } else {
        // Fallback lexical token overlap match
        const queryTerms = cleanQuery.toLowerCase().split(/\s+/).filter(t => t.length > 2);
        const contentLower = chunk.content.toLowerCase();
        let matches = 0;
        for (const term of queryTerms) {
          if (contentLower.includes(term)) matches++;
        }
        similarity = queryTerms.length > 0 ? (matches / queryTerms.length) * 0.5 : 0;
      }

      if (similarity >= minSimilarity) {
        scoredResults.push({
          chunkId: chunk.chunkId,
          docId: chunk.docId,
          source: chunk.source,
          title: chunk.title,
          content: chunk.content,
          similarity,
          metadata: chunk.metadata || {}
        });
      }
    }

    // Sort by descending similarity score and take top K
    scoredResults.sort((a, b) => b.similarity - a.similarity);
    return scoredResults.slice(0, topK);
  }

  /**
   * Formats retrieved chunks into an augmented context block for LLM system prompts.
   */
  public formatContext(results: RagSearchResult[]): string {
    if (!results || results.length === 0) {
      return '';
    }

    const formattedDocs = results.map((r, idx) => {
      return `[Source ${idx + 1}: ${r.title} (source_id: ${r.source})]\n${r.content}`;
    }).join('\n\n');

    return `\n\n--- OFFICIAL NEXA DOCUMENTATION CONTEXT ---\nUse the following verified platform documentation when answering the user's questions about NEXA features, setup, privacy, or manual instructions:\n\n${formattedDocs}\n\nRules when using documentation:\n1. If the user asks about a NEXA feature or guideline present in this context, answer accurately based strictly on this information.\n2. Always state that this information comes from NEXA Documentation.\n3. If the user asks about NEXA features not covered in this context, state clearly that you do not have official documentation on that specific topic rather than fabricating instructions.\n--- END OF DOCUMENTATION CONTEXT ---\n`;
  }
}

export const ragRetriever = new RAGRetriever();
