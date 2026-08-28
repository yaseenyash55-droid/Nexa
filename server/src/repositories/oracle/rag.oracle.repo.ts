import oracledb from 'oracledb';
import { executeSql, isOraclePoolInitialized } from '../../db/pool.js';
import { IRagDocumentRepository, RagDocument } from '../../types/ai.types.js';
import { logger } from '../../utils/logger.js';

export class OracleRagDocumentRepository implements IRagDocumentRepository {
  public async upsertDocument(source: string, title: string, category: string): Promise<RagDocument> {
    const checkSql = `
      SELECT DOC_ID, SOURCE, TITLE, CATEGORY, CREATED_AT, UPDATED_AT
      FROM AI_KNOWLEDGE_DOCS
      WHERE SOURCE = :source
    `;

    const existing = await executeSql<{
      DOC_ID: number;
      SOURCE: string;
      TITLE: string;
      CATEGORY: string;
      CREATED_AT: Date;
      UPDATED_AT: Date;
    }>(checkSql, { source });

    if (existing.rows && existing.rows.length > 0) {
      const row = existing.rows[0];
      const updateSql = `
        UPDATE AI_KNOWLEDGE_DOCS
        SET TITLE = :title, CATEGORY = :category, UPDATED_AT = SYSTIMESTAMP
        WHERE DOC_ID = :docId
      `;
      await executeSql(updateSql, { title, category, docId: row.DOC_ID }, { autoCommit: true });

      return {
        docId: Number(row.DOC_ID),
        source: row.SOURCE,
        title,
        category,
        createdAt: new Date(row.CREATED_AT),
        updatedAt: new Date()
      };
    }

    const insertSql = `
      INSERT INTO AI_KNOWLEDGE_DOCS (SOURCE, TITLE, CATEGORY)
      VALUES (:source, :title, :category)
      RETURNING DOC_ID, SOURCE, TITLE, CATEGORY, CREATED_AT, UPDATED_AT
      INTO :out_id, :out_source, :out_title, :out_category, :out_created_at, :out_updated_at
    `;

    const binds = {
      source,
      title,
      category,
      out_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT },
      out_source: { type: oracledb.STRING, dir: oracledb.BIND_OUT },
      out_title: { type: oracledb.STRING, dir: oracledb.BIND_OUT },
      out_category: { type: oracledb.STRING, dir: oracledb.BIND_OUT },
      out_created_at: { type: oracledb.DATE, dir: oracledb.BIND_OUT },
      out_updated_at: { type: oracledb.DATE, dir: oracledb.BIND_OUT }
    };

    const res = await executeSql(insertSql, binds, { autoCommit: true });
    const out = res.outBinds as any;

    return {
      docId: Number(Array.isArray(out.out_id) ? out.out_id[0] : out.out_id),
      source: String(Array.isArray(out.out_source) ? out.out_source[0] : out.out_source),
      title: String(Array.isArray(out.out_title) ? out.out_title[0] : out.out_title),
      category: String(Array.isArray(out.out_category) ? out.out_category[0] : out.out_category),
      createdAt: new Date(Array.isArray(out.out_created_at) ? out.out_created_at[0] : out.out_created_at),
      updatedAt: new Date(Array.isArray(out.out_updated_at) ? out.out_updated_at[0] : out.out_updated_at)
    };
  }

  public async saveChunks(
    docId: number,
    chunks: Array<{
      chunkIndex: number;
      content: string;
      metadata: Record<string, any>;
      embedding: number[];
    }>
  ): Promise<void> {
    // Delete existing chunks for this doc first to allow clean idempotency
    await executeSql(
      `DELETE FROM AI_KNOWLEDGE_CHUNKS WHERE DOC_ID = :docId`,
      { docId },
      { autoCommit: true }
    );

    const insertChunkSql = `
      INSERT INTO AI_KNOWLEDGE_CHUNKS (DOC_ID, CHUNK_INDEX, CONTENT, METADATA_JSON, EMBEDDING_JSON)
      VALUES (:docId, :chunkIndex, :content, :metadataJson, :embeddingJson)
    `;

    for (const chunk of chunks) {
      await executeSql(
        insertChunkSql,
        {
          docId,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          metadataJson: JSON.stringify(chunk.metadata || {}),
          embeddingJson: JSON.stringify(chunk.embedding || [])
        },
        { autoCommit: true }
      );
    }
  }

  public async getAllChunksWithEmbeddings(): Promise<Array<{
    chunkId: number;
    docId: number;
    source: string;
    title: string;
    content: string;
    metadata: Record<string, any>;
    embedding: number[];
  }>> {
    if (!isOraclePoolInitialized()) {
      return [];
    }

    const sql = `
      SELECT
        c.CHUNK_ID,
        c.DOC_ID,
        d.SOURCE,
        d.TITLE,
        c.CONTENT,
        c.METADATA_JSON,
        c.EMBEDDING_JSON
      FROM AI_KNOWLEDGE_CHUNKS c
      JOIN AI_KNOWLEDGE_DOCS d ON c.DOC_ID = d.DOC_ID
      ORDER BY c.DOC_ID, c.CHUNK_INDEX ASC
    `;

    const result = await executeSql<{
      CHUNK_ID: number;
      DOC_ID: number;
      SOURCE: string;
      TITLE: string;
      CONTENT: string;
      METADATA_JSON: string;
      EMBEDDING_JSON: string;
    }>(sql);

    if (!result.rows) return [];

    return result.rows.map((row) => {
      let metadata = {};
      let embedding: number[] = [];

      try {
        metadata = JSON.parse(row.METADATA_JSON || '{}');
      } catch {}

      try {
        embedding = JSON.parse(row.EMBEDDING_JSON || '[]');
      } catch {}

      return {
        chunkId: Number(row.CHUNK_ID),
        docId: Number(row.DOC_ID),
        source: row.SOURCE,
        title: row.TITLE,
        content: String(row.CONTENT || ''),
        metadata,
        embedding
      };
    });
  }

  public async getDocumentsCount(): Promise<number> {
    const res = await executeSql<{ COUNT: number }>(`SELECT COUNT(*) AS "COUNT" FROM AI_KNOWLEDGE_DOCS`);
    return Number(res.rows?.[0]?.COUNT || 0);
  }

  public async getChunksCount(): Promise<number> {
    const res = await executeSql<{ COUNT: number }>(`SELECT COUNT(*) AS "COUNT" FROM AI_KNOWLEDGE_CHUNKS`);
    return Number(res.rows?.[0]?.COUNT || 0);
  }
}
