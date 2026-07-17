import { Logger } from '@nestjs/common';
import type { EmbeddingsInterface } from '@langchain/core/embeddings';
import { OpenAIEmbeddings } from '@langchain/openai';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { TaskType } from '@google/generative-ai';

/**
 * Provider d'embeddings du RAG. CONTRAIREMENT au LLM de génération (choisi par
 * requête), le provider d'embeddings est GLOBAL : l'index Atlas
 * `rag_vector_index` vit dans un seul espace vectoriel — les vecteurs de la
 * question doivent venir du même modèle que ceux des chunks indexés.
 * Après un changement de RAG_EMBEDDINGS_PROVIDER, il FAUT réindexer :
 * POST /rag/admin/reindex/:sourceType pour chaque type de source.
 */
export type RagEmbeddingsProvider = 'openai' | 'gemini';

/** Dimension de l'index Atlas rag_vector_index (cf. rag-chunk.schema.ts). */
export const EMBEDDING_DIMENSIONS = 1536;

const DEFAULT_EMBEDDING_MODELS: Record<RagEmbeddingsProvider, string> = {
  openai: 'text-embedding-3-small', // 1536 dims natif
  gemini: 'gemini-embedding-001', // 3072 dims, tronqué à 1536 (Matryoshka)
};

/** Ingestion (documents) ou recherche (requête) — améliore la pertinence Gemini. */
export type EmbeddingsUsage = 'document' | 'query';

export interface RagEmbeddings {
  provider: RagEmbeddingsProvider;
  embeddings: EmbeddingsInterface;
}

const logger = new Logger('RagEmbeddingsFactory');

function hasKey(provider: RagEmbeddingsProvider): boolean {
  return provider === 'openai'
    ? Boolean(process.env.OPENAI_API_KEY?.trim())
    : Boolean(process.env.GOOGLE_API_KEY?.trim());
}

export function resolveEmbeddingsProvider(): RagEmbeddingsProvider | undefined {
  const requested = process.env.RAG_EMBEDDINGS_PROVIDER?.trim() as
    | RagEmbeddingsProvider
    | undefined;
  const candidates: RagEmbeddingsProvider[] = [
    ...(requested === 'openai' || requested === 'gemini' ? [requested] : []),
    'openai',
    'gemini',
  ];
  const resolved = candidates.find(hasKey);

  if (!resolved) {
    logger.warn(
      "Aucune clé d'embeddings configurée (OPENAI_API_KEY ou GOOGLE_API_KEY) — la recherche sémantique du RAG est désactivée.",
    );
    return undefined;
  }
  if (requested && resolved !== requested) {
    logger.warn(
      `Provider d'embeddings demandé "${requested}" sans clé associée — bascule sur "${resolved}".`,
    );
  }
  return resolved;
}

/**
 * Les embeddings Gemini sortent en 3072 dims ; l'index Atlas est en 1536.
 * gemini-embedding-001 étant un modèle Matryoshka, la troncature aux 1536
 * premières composantes + renormalisation L2 est la méthode recommandée par
 * Google (équivalent du paramètre outputDimensionality de leur API, que
 * @langchain/google-genai n'expose pas encore).
 */
class FixedDimensionsEmbeddings implements EmbeddingsInterface {
  constructor(
    private readonly inner: EmbeddingsInterface,
    private readonly dimensions: number,
  ) {}

  async embedDocuments(documents: string[]): Promise<number[][]> {
    const vectors = await this.inner.embedDocuments(documents);
    return vectors.map((vector) => this.fit(vector));
  }

  async embedQuery(document: string): Promise<number[]> {
    return this.fit(await this.inner.embedQuery(document));
  }

  private fit(vector: number[]): number[] {
    if (vector.length === this.dimensions) return vector;
    if (vector.length < this.dimensions) {
      throw new Error(
        `Embedding de ${vector.length} dims : trop court pour l'index (${this.dimensions} dims). ` +
          'Utilisez un modèle produisant au moins autant de dimensions (ex: gemini-embedding-001).',
      );
    }
    const truncated = vector.slice(0, this.dimensions);
    const norm = Math.sqrt(truncated.reduce((sum, x) => sum + x * x, 0)) || 1;
    return truncated.map((x) => x / norm);
  }
}

export function createRagEmbeddings(usage: EmbeddingsUsage): RagEmbeddings | undefined {
  const provider = resolveEmbeddingsProvider();
  if (!provider) return undefined;

  if (provider === 'gemini') {
    const inner = new GoogleGenerativeAIEmbeddings({
      model:
        process.env.RAG_GEMINI_EMBEDDING_MODEL?.trim() ||
        DEFAULT_EMBEDDING_MODELS.gemini,
      taskType:
        usage === 'document' ? TaskType.RETRIEVAL_DOCUMENT : TaskType.RETRIEVAL_QUERY,
    });
    return {
      provider,
      embeddings: new FixedDimensionsEmbeddings(inner, EMBEDDING_DIMENSIONS),
    };
  }

  return {
    provider,
    embeddings: new OpenAIEmbeddings({
      model:
        process.env.RAG_OPENAI_EMBEDDING_MODEL?.trim() ||
        DEFAULT_EMBEDDING_MODELS.openai,
    }),
  };
}
