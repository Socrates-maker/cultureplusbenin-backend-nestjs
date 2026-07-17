/**
 * Types de contenus source pouvant être indexés dans le RAG.
 * Doit correspondre à vos modules métier existants.
 * -> QuizModule, MediaModule, UsersModule, AuthModule, CaslModule sont volontairement exclus.
 */
export enum RagSourceType {
  TOURIST_SITE = 'TouristSite',
  HISTORICAL_FIGURE = 'HistoricalFigure',
  CITY = 'City',
  MEMORY = 'Memory',
  TESTIMONIAL = 'Testimonial',
  GALLERY = 'Gallery',
}

export const RAG_EVENTS = {
  CONTENT_UPSERTED: 'rag.content.upserted',
  CONTENT_DELETED: 'rag.content.deleted',
} as const;

// Config par défaut du chunking, ajustable par type de source dans chaque adapter
export const DEFAULT_CHUNK_SIZE = 800; // caractères
export const DEFAULT_CHUNK_OVERLAP = 120;

// Seuil de score minimum sous lequel on considère qu'aucun contexte pertinent n'a été trouvé
export const MIN_SIMILARITY_SCORE = 0.72;
