import { RagSourceType } from '../rag.constants';

/**
 * Représentation "à plat" d'un document source, prête pour le chunking + embedding.
 * Chaque adapter (TouristSite, HistoricalFigure...) transforme son propre schéma
 * Mongoose vers cette forme commune.
 */
export interface RagIngestableDocument {
  sourceId: string;
  sourceType: RagSourceType;
  sourceTitle: string;
  // Texte brut complet à découper en chunks (déjà nettoyé du HTML/markdown si besoin)
  fullText: string;
  metadata: {
    cityId?: string;
    cityName?: string;
    region?: string;
    category?: string;
    tags?: string[];
    era?: string;
    dateEvent?: Date;
  };
  mediaUrls?: string[];
}

/**
 * Contrat que chaque module métier doit implémenter pour être indexable dans le RAG.
 * Permet au RagIngestionService de rester complètement agnostique du schéma
 * de chaque module (TouristSite, HistoricalFigure, City, Memory, Testimonial, Gallery).
 */
export interface RagSourceAdapter {
  readonly sourceType: RagSourceType;

  // Récupère et transforme un document par son id
  fetchOne(id: string): Promise<RagIngestableDocument | null>;

  // Récupère tous les documents éligibles (utilisé par le job de réindexation complète)
  fetchAll(): Promise<RagIngestableDocument[]>;
}
