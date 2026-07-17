import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { RagSourceType } from '../rag.constants';
import { ApiProperty } from '@nestjs/swagger';

export type RagChunkDocument = RagChunk & Document;

@Schema({ timestamps: true, collection: 'rag_chunks' })
export class RagChunk {
  @ApiProperty({ type: String, format: 'uuid', description: 'Identifiant unique du chunk (UUID)' })
  @Prop({ required: true, type: Types.ObjectId })
  sourceId: Types.ObjectId;

  @ApiProperty({ type: String, enum: Object.values(RagSourceType) })
  @Prop({ type: String, required: true, enum: Object.values(RagSourceType) })
  sourceType: RagSourceType;

 @ApiProperty({ type: String, description: 'Titre du document source (ex: nom du site touristique, nom de la figure historique)' })
  @Prop({ required: true })
  sourceTitle: string;

  @ApiProperty({ type: String, description: 'Texte du chunk (extrait du document source)' })
  @Prop({ required: true })
  content: string;

  // Position du chunk dans le document source (0, 1, 2...) — utile pour debug/reconstruction
  @ApiProperty({ type: Number, description: 'Position du chunk dans le document source' })
  @Prop({ required: true, default: 0 })
  chunkIndex: number;

  // Hash SHA-256 du texte source complet (avant chunking) -> permet de détecter un contenu
  // modifié sans avoir à comparer le texte intégral à chaque fois
  @ApiProperty({ type: String, description: 'Hash SHA-256 du texte source complet' }) 
  @Prop({ required: true })
  contentHash: string;

  // Vecteur d'embedding. Dimension dépend du modèle choisi
  // (1536 pour text-embedding-3-small OpenAI)
  @Prop({ type: [Number], required: true })
  embedding: number[];

  // Permet de ré-embedder en masse si vous changez de modèle d'embedding un jour
  @Prop({ default: 1 })
  embeddingVersion: number;

  // Métadonnées structurées pour le filtrage hybride ($match + $vectorSearch)
  @ApiProperty({ type: Object, description: 'Métadonnées structurées pour le filtrage hybride' })
  @Prop({ type: Object, default: {} })
  metadata: {
    cityId?: string;
    cityName?: string;
    region?: string;
    category?: string;
    tags?: string[];
    era?: string; // pour HistoricalFigure
    dateEvent?: Date;
  };

  // URL(s) de média associées, pour enrichir la réponse du chatbot (via MediaModule)
  @ApiProperty({ type: [String], description: 'URL(s) de média associées' })
  @Prop({ type: [String], default: [] })
  mediaUrls: string[];
}

export const RagChunkSchema = SchemaFactory.createForClass(RagChunk);

// Index composé pour accélérer les requêtes de nettoyage/mise à jour par source
RagChunkSchema.index({ sourceId: 1, sourceType: 1 });

/**
 * IMPORTANT — Index vectoriel Atlas Search à créer manuellement (pas via Mongoose) :
 * Dans Atlas UI > Search > Create Search Index > JSON Editor, sur la collection `rag_chunks` :
 *
 * {
 *   "fields": [
 *     {
 *       "type": "vector",
 *       "path": "embedding",
 *       "numDimensions": 1536,
 *       "similarity": "cosine"
 *     },
 *     { "type": "filter", "path": "sourceType" },
 *     { "type": "filter", "path": "metadata.region" },
 *     { "type": "filter", "path": "metadata.category" },
 *     { "type": "filter", "path": "metadata.cityId" }
 *   ]
 * }
 * Nommez cet index "rag_vector_index" (utilisé dans rag-retrieval.service.ts).
 */
