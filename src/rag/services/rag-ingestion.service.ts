import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { OnEvent } from '@nestjs/event-emitter';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { createRagEmbeddings, type RagEmbeddings } from './rag-embeddings.factory';
import * as crypto from 'crypto';
import { RagChunk, RagChunkDocument } from '../schemas/rag-chunk.schema';
import { RagSourceAdapter, RagIngestableDocument } from '../interfaces/rag-source-adapter.interface';
import { RagSourceType, DEFAULT_CHUNK_SIZE, DEFAULT_CHUNK_OVERLAP, RAG_EVENTS } from '../rag.constants';

interface ContentUpsertedPayload {
  sourceType: RagSourceType;
  sourceId: string;
}
interface ContentDeletedPayload {
  sourceType: RagSourceType;
  sourceId: string;
}

@Injectable()
export class RagIngestionService {
  private readonly logger = new Logger(RagIngestionService.name);
  // Provider global d'embeddings (RAG_EMBEDDINGS_PROVIDER) — après un
  // changement, réindexer toutes les sources (voir rag-embeddings.factory.ts).
  private readonly ragEmbeddings?: RagEmbeddings;
  private readonly splitter: RecursiveCharacterTextSplitter;
  private readonly adapters: Map<RagSourceType, RagSourceAdapter>;

  constructor(
    @InjectModel(RagChunk.name) private readonly ragChunkModel: Model<RagChunkDocument>,
    // Liste injectée via le provider factory 'RAG_SOURCE_ADAPTERS' (voir rag.module.ts)
    @Inject('RAG_SOURCE_ADAPTERS') adaptersList: RagSourceAdapter[],
  ) {
    this.ragEmbeddings = createRagEmbeddings('document');
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: DEFAULT_CHUNK_SIZE,
      chunkOverlap: DEFAULT_CHUNK_OVERLAP,
      separators: ['\n\n', '\n', '. ', ' ', ''],
    });
    this.adapters = new Map(adaptersList.map((a) => [a.sourceType, a]));
  }

  @OnEvent(RAG_EVENTS.CONTENT_UPSERTED)
  async handleContentUpserted(payload: ContentUpsertedPayload) {
    try {
      await this.indexOne(payload.sourceType, payload.sourceId);
    } catch (err) {
      // On log sans faire planter le flux principal (create/update du contenu métier
      // ne doit jamais échouer à cause d'un problème d'indexation RAG)
      this.logger.error(
        `Échec indexation ${payload.sourceType}/${payload.sourceId}: ${err.message}`,
        err.stack,
      );
    }
  }

  @OnEvent(RAG_EVENTS.CONTENT_DELETED)
  async handleContentDeleted(payload: ContentDeletedPayload) {
    await this.ragChunkModel.deleteMany({
      sourceId: new Types.ObjectId(payload.sourceId),
      sourceType: payload.sourceType,
    });
  }

  /**
   * Indexe (ou ré-indexe) un document unique.
   * Idempotent : si le contentHash n'a pas changé, ne fait rien.
   */
  async indexOne(sourceType: RagSourceType, sourceId: string): Promise<void> {
    const adapter = this.adapters.get(sourceType);
    if (!adapter) {
      this.logger.warn(`Aucun adapter RAG enregistré pour le type ${sourceType}`);
      return;
    }

    const doc = await adapter.fetchOne(sourceId);
    if (!doc || !doc.fullText?.trim()) {
      // Document supprimé ou vide -> on nettoie les chunks existants
      await this.ragChunkModel.deleteMany({ sourceId: new Types.ObjectId(sourceId), sourceType });
      return;
    }

    const contentHash = this.hashText(doc.fullText);
    const existing = await this.ragChunkModel
      .findOne({ sourceId: new Types.ObjectId(sourceId), sourceType })
      .select('contentHash embeddingProvider')
      .lean();

    if (
      existing?.contentHash === contentHash &&
      existing?.embeddingProvider === this.ragEmbeddings?.provider
    ) {
      return; // rien n'a changé (contenu ET provider), on évite un ré-embedding inutile
    }

    await this.embedAndUpsert(doc, contentHash);
    this.logger.log(`Indexé: ${sourceType}/${sourceId} ("${doc.sourceTitle}")`);
  }

  /**
   * Réindexation complète d'un type de source. À utiliser lors de la mise en place
   * initiale, ou après un changement de modèle d'embedding.
   */
  async reindexAll(sourceType: RagSourceType): Promise<{ indexed: number; skipped: number }> {
    const adapter = this.adapters.get(sourceType);
    if (!adapter) throw new Error(`Aucun adapter pour ${sourceType}`);

    const docs = await adapter.fetchAll();
    let indexed = 0;
    let skipped = 0;

    // Traitement séquentiel par petits lots pour ne pas exploser les rate limits
    // de l'API d'embedding
    const BATCH_SIZE = 10;
    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = docs.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (doc) => {
          if (!doc.fullText?.trim()) {
            skipped++;
            return;
          }
          const contentHash = this.hashText(doc.fullText);
          await this.embedAndUpsert(doc, contentHash);
          indexed++;
        }),
      );
    }
    return { indexed, skipped };
  }

  private async embedAndUpsert(doc: RagIngestableDocument, contentHash: string): Promise<void> {
    const ragEmbeddings = this.ragEmbeddings;
    if (!ragEmbeddings) {
      return;
    }

    const chunks = await this.splitter.splitText(doc.fullText);
    const vectors = await ragEmbeddings.embeddings.embedDocuments(chunks);

    const sourceObjectId = new Types.ObjectId(doc.sourceId);

    // On supprime les anciens chunks puis on réinsère (plus simple et sûr qu'un diff fin,
    // le volume par document reste faible)
    await this.ragChunkModel.deleteMany({ sourceId: sourceObjectId, sourceType: doc.sourceType });

    const rows = chunks.map((content, idx) => ({
      sourceId: sourceObjectId,
      sourceType: doc.sourceType,
      sourceTitle: doc.sourceTitle,
      content,
      chunkIndex: idx,
      contentHash,
      embedding: vectors[idx],
      embeddingVersion: 1,
      embeddingProvider: ragEmbeddings.provider,
      metadata: doc.metadata,
      mediaUrls: doc.mediaUrls ?? [],
    }));

    await this.ragChunkModel.insertMany(rows);
  }

  private hashText(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
  }
}
