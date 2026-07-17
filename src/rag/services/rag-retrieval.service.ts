import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OpenAIEmbeddings } from '@langchain/openai';
import { RagChunk, RagChunkDocument } from '../schemas/rag-chunk.schema';
import { MIN_SIMILARITY_SCORE, RagSourceType } from '../rag.constants';

export interface RetrievedChunk {
  sourceId: string;
  sourceType: RagSourceType;
  sourceTitle: string;
  content: string;
  score: number;
  mediaUrls: string[];
}

export interface StructuredFilters {
  region?: string;
  category?: string;
  cityId?: string;
  sourceType?: RagSourceType;
}

@Injectable()
export class RagRetrievalService {
  private readonly embeddings?: OpenAIEmbeddings;
  private readonly hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY?.trim());

  constructor(@InjectModel(RagChunk.name) private readonly ragChunkModel: Model<RagChunkDocument>) {
    if (this.hasOpenAiKey) {
      this.embeddings = new OpenAIEmbeddings({ model: 'text-embedding-3-small' });
    }
  }

  /**
   * Recherche sémantique pure (Atlas $vectorSearch), utilisée pour les questions
   * factuelles ("qui était Béhanzin ?", "que s'est-il passé à Ouidah en...")
   * Nécessite l'index "rag_vector_index" créé sur la collection rag_chunks (cf. schema).
   */
  async semanticSearch(
    query: string,
    filters?: StructuredFilters,
    topK = 6,
  ): Promise<RetrievedChunk[]> {
    if (!this.embeddings) {
      return this.browseByFilters(filters ?? {}, topK);
    }

    const queryVector = await this.embeddings.embedQuery(query);

    const preFilter: Record<string, any> = {};
    if (filters?.sourceType) preFilter.sourceType = { $eq: filters.sourceType };
    if (filters?.region) preFilter['metadata.region'] = { $eq: filters.region };
    if (filters?.category) preFilter['metadata.category'] = { $eq: filters.category };
    if (filters?.cityId) preFilter['metadata.cityId'] = { $eq: filters.cityId };

    const results = await this.ragChunkModel.aggregate([
      {
        $vectorSearch: {
          index: 'rag_vector_index',
          path: 'embedding',
          queryVector,
          numCandidates: topK * 20,
          limit: topK,
          ...(Object.keys(preFilter).length ? { filter: preFilter } : {}),
        },
      },
      {
        $project: {
          sourceId: 1,
          sourceType: 1,
          sourceTitle: 1,
          content: 1,
          mediaUrls: 1,
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ]);

    return results
      .filter((r) => r.score >= MIN_SIMILARITY_SCORE)
      .map((r) => ({
        sourceId: r.sourceId.toString(),
        sourceType: r.sourceType,
        sourceTitle: r.sourceTitle,
        content: r.content,
        score: r.score,
        mediaUrls: r.mediaUrls ?? [],
      }));
  }

  /**
   * Recherche structurée (sans embedding), utilisée pour l'exploration guidée
   * ("montre-moi des contenus sur le vaudou dans le sud du Bénin").
   * Retourne les chunks les plus représentatifs (chunkIndex 0) de chaque document filtré.
   */
  async browseByFilters(filters: StructuredFilters, limit = 10): Promise<RetrievedChunk[]> {
    const query: Record<string, any> = { chunkIndex: 0 };
    if (filters.sourceType) query.sourceType = filters.sourceType;
    if (filters.region) query['metadata.region'] = filters.region;
    if (filters.category) query['metadata.category'] = filters.category;
    if (filters.cityId) query['metadata.cityId'] = filters.cityId;

    const results = await this.ragChunkModel.find(query).limit(limit).lean();

    return results.map((r) => ({
      sourceId: r.sourceId.toString(),
      sourceType: r.sourceType,
      sourceTitle: r.sourceTitle,
      content: r.content,
      score: 1, // pas de score de similarité en mode filtre pur
      mediaUrls: r.mediaUrls ?? [],
    }));
  }
}
