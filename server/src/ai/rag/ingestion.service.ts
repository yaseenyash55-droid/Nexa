import { getRagDocumentRepository } from '../../repositories/factory.js';
import { aiEmbeddingService } from './embedding.service.js';
import { APPROVED_NEXA_DOCUMENTATION, ApprovedDocItem } from './approved.docs.js';
import { logger } from '../../utils/logger.js';

export interface ChunkingOptions {
  chunkSize?: number; // character length per chunk
  chunkOverlap?: number;
}

export class RAGIngestionService {
  /**
   * Splits a long text into overlapping chunks.
   */
  public chunkText(text: string, options: ChunkingOptions = {}): string[] {
    const chunkSize = options.chunkSize || 600;
    const overlap = options.chunkOverlap || 100;

    const clean = text.trim();
    if (!clean) return [];
    if (clean.length <= chunkSize) return [clean];

    const chunks: string[] = [];
    let start = 0;

    while (start < clean.length) {
      let end = start + chunkSize;

      // If we are not at the end of the text, try finding a sentence or paragraph break
      if (end < clean.length) {
        const breakPoint = clean.lastIndexOf('\n', end);
        const sentencePoint = clean.lastIndexOf('. ', end);

        if (breakPoint > start + 100) {
          end = breakPoint + 1;
        } else if (sentencePoint > start + 100) {
          end = sentencePoint + 1;
        }
      }

      const chunk = clean.slice(start, end).trim();
      if (chunk) {
        chunks.push(chunk);
      }

      start = end - overlap;
      if (start >= clean.length || end >= clean.length) break;
    }

    return chunks;
  }

  /**
   * Ingests a single approved document item into Oracle knowledge storage.
   */
  public async ingestDocument(doc: ApprovedDocItem): Promise<{ docId: number; chunksCount: number }> {
    const ragRepo = getRagDocumentRepository();

    // 1. Upsert document header
    const savedDoc = await ragRepo.upsertDocument(doc.source, doc.title, doc.category);

    // 2. Chunk text
    const textChunks = this.chunkText(doc.content);

    // 3. Generate embeddings and prepare chunks
    const chunkRecords: Array<{
      chunkIndex: number;
      content: string;
      metadata: Record<string, any>;
      embedding: number[];
    }> = [];

    for (let i = 0; i < textChunks.length; i++) {
      const chunkText = textChunks[i];
      let embedding: number[] = [];

      try {
        embedding = await aiEmbeddingService.getEmbedding(chunkText);
      } catch (err: any) {
        logger.warn({ err: err?.message || err, source: doc.source }, 'Failed to compute embedding; storing chunk with empty vector');
      }

      chunkRecords.push({
        chunkIndex: i,
        content: chunkText,
        metadata: {
          source: doc.source,
          title: doc.title,
          category: doc.category,
          chunkIndex: i
        },
        embedding
      });
    }

    // 4. Save chunks
    await ragRepo.saveChunks(savedDoc.docId, chunkRecords);

    logger.info({ docId: savedDoc.docId, source: doc.source, count: chunkRecords.length }, 'RAG Document ingested successfully');
    return { docId: savedDoc.docId, chunksCount: chunkRecords.length };
  }

  /**
   * Ingests all approved documentation sources.
   */
  public async ingestAllApprovedDocs(): Promise<{ totalDocs: number; totalChunks: number }> {
    let totalChunks = 0;

    for (const doc of APPROVED_NEXA_DOCUMENTATION) {
      const res = await this.ingestDocument(doc);
      totalChunks += res.chunksCount;
    }

    return {
      totalDocs: APPROVED_NEXA_DOCUMENTATION.length,
      totalChunks
    };
  }
}

export const ragIngestionService = new RAGIngestionService();
