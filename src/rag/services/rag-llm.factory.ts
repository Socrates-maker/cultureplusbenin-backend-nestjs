import { Logger } from '@nestjs/common';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';

/**
 * Fournisseurs de LLM supportés pour la génération des réponses du chat RAG.
 * NB : ne concerne QUE la génération — les embeddings restent sur OpenAI
 * (l'index Atlas `rag_vector_index` est construit dans cet espace vectoriel ;
 * en changer imposerait une réindexation complète, cf. rag-chunk.schema.ts).
 */
export type RagLlmProvider = 'openai' | 'gemini';

export const RAG_LLM_PROVIDERS: readonly RagLlmProvider[] = ['openai', 'gemini'];

const DEFAULT_MODELS: Record<RagLlmProvider, string> = {
  openai: 'gpt-4o-mini',
  // Alias qui suit le dernier modèle Flash — les modèles datés (ex:
  // gemini-2.5-flash) finissent par être fermés aux nouveaux comptes (404).
  gemini: 'gemini-flash-latest',
};

// Surcharge du modèle par provider (le choix de provider pouvant changer à
// chaque requête, une variable unique serait ambiguë).
const MODEL_ENV_VARS: Record<RagLlmProvider, string> = {
  openai: 'RAG_OPENAI_MODEL',
  gemini: 'RAG_GEMINI_MODEL',
};

const TEMPERATURE = 0.3;

const logger = new Logger('RagLlmFactory');

function hasKey(provider: RagLlmProvider): boolean {
  return provider === 'openai'
    ? Boolean(process.env.OPENAI_API_KEY?.trim())
    : Boolean(process.env.GOOGLE_API_KEY?.trim());
}

/** Providers réellement utilisables (clé API présente). */
export function availableRagProviders(): RagLlmProvider[] {
  return RAG_LLM_PROVIDERS.filter(hasKey);
}

/** Provider par défaut déclaré via RAG_LLM_PROVIDER (défaut : openai). */
export function defaultRagProvider(): RagLlmProvider {
  const declared = process.env.RAG_LLM_PROVIDER?.trim() as RagLlmProvider | undefined;
  return declared && RAG_LLM_PROVIDERS.includes(declared) ? declared : 'openai';
}

/**
 * Résout le provider effectif : celui demandé par la requête, sinon le défaut
 * d'environnement, sinon n'importe lequel disposant d'une clé. Retourne
 * undefined si aucune clé n'est configurée (le chat dégrade en "sources seules").
 */
export function resolveRagProvider(
  requested?: RagLlmProvider,
): RagLlmProvider | undefined {
  const candidates: RagLlmProvider[] = [
    ...(requested ? [requested] : []),
    defaultRagProvider(),
    ...RAG_LLM_PROVIDERS,
  ];
  const resolved = candidates.find(hasKey);

  if (!resolved) {
    logger.warn(
      'Aucune clé LLM configurée (OPENAI_API_KEY ou GOOGLE_API_KEY) — le chat RAG répondra en mode dégradé.',
    );
    return undefined;
  }
  if (requested && resolved !== requested) {
    logger.warn(
      `Provider RAG demandé "${requested}" sans clé associée — bascule sur "${resolved}".`,
    );
  }
  return resolved;
}

/** Instancie le modèle de chat d'un provider (clé supposée présente). */
export function createRagLlm(provider: RagLlmProvider): BaseChatModel {
  const model =
    process.env[MODEL_ENV_VARS[provider]]?.trim() || DEFAULT_MODELS[provider];

  if (provider === 'gemini') {
    return new ChatGoogleGenerativeAI({ model, temperature: TEMPERATURE });
  }
  return new ChatOpenAI({ model, temperature: TEMPERATURE });
}
