import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RAGIngestionService } from '../src/ai/rag/ingestion.service.js';
import { RAGRetriever } from '../src/ai/rag/retriever.js';
import { AIEmbeddingService } from '../src/ai/rag/embedding.service.js';

describe('NEXA AI RAG Foundation Suite', () => {
  it('chunks documentation text correctly with overlap and boundary preservation', () => {
    const service = new RAGIngestionService();
    const sampleDoc = `NEXA Social Network is an enterprise-grade platform.
It supports realtime messaging with E2EE.
It also supports AI assistant integrations and secure media streaming.
Users can customize their privacy controls easily.`;

    const chunks = service.chunkText(sampleDoc, { chunkSize: 80, chunkOverlap: 20 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].length).toBeLessThanOrEqual(80);
    // Ensure chunks cover the entire text
    expect(chunks.some(c => c.includes('NEXA Social Network'))).toBe(true);
    expect(chunks.some(c => c.includes('privacy controls'))).toBe(true);
  });

  it('calculates vector cosine similarity accurately', () => {
    const embeddingService = new AIEmbeddingService();

    const vecA = [1, 0, 0];
    const vecB = [1, 0, 0];
    const vecC = [0, 1, 0];
    const vecD = [0.707, 0.707, 0];

    expect(embeddingService.cosineSimilarity(vecA, vecB)).toBeCloseTo(1.0, 4);
    expect(embeddingService.cosineSimilarity(vecA, vecC)).toBeCloseTo(0.0, 4);
    expect(embeddingService.cosineSimilarity(vecA, vecD)).toBeGreaterThan(0.7);
  });

  it('formats retrieved RAG documentation chunks with source metadata', () => {
    const retriever = new RAGRetriever();
    const mockResults = [
      {
        chunkId: 1,
        docId: 101,
        source: 'user_manual_privacy_protection',
        title: '5. Privacy Settings & Account Protection Center',
        content: 'Manage two-factor authentication (2FA) via email OTP.',
        similarity: 0.89,
        metadata: { category: 'privacy' }
      }
    ];

    const formattedContext = retriever.formatContext(mockResults);
    expect(formattedContext).toContain('OFFICIAL NEXA DOCUMENTATION CONTEXT');
    expect(formattedContext).toContain('5. Privacy Settings & Account Protection Center');
    expect(formattedContext).toContain('source_id: user_manual_privacy_protection');
    expect(formattedContext).toContain('Manage two-factor authentication (2FA)');
    expect(formattedContext).toContain('Rules when using documentation');
  });

  it('returns empty string if no relevant RAG chunks are retrieved', () => {
    const retriever = new RAGRetriever();
    const formatted = retriever.formatContext([]);
    expect(formatted).toBe('');
  });
});
