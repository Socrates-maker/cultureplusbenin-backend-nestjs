import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RagChunk, RagChunkSchema } from './schemas/rag-chunk.schema';
import { ChatSession, ChatSessionSchema } from './schemas/chat-session.schema';
import { RagIngestionService } from './services/rag-ingestion.service';
import { RagRetrievalService } from './services/rag-retrieval.service';
import { RagChatService } from './services/rag-chat.service';
import { RagController } from './rag.controller';
import { TouristSiteAdapter } from './adapters/tourist-site.adapter';
import { HistoricalFigureAdapter } from './adapters/historical-figure.adapter';
import { CityAdapter, MemoryAdapter, TestimonialAdapter, GalleryAdapter } from './adapters/misc-sources.adapter';
import { TouristSite, TouristSiteSchema } from '../tourist-sites/schemas/tourist-site.schema';
import { HistoricalFigure, HistoricalFigureSchema } from '../historical-figures/schemas/historical-figure.schema';
import { City, CitySchema } from '../cities/schemas/city.schema';
import { MemoryItem, MemoryItemSchema } from '../memory/schemas/memory-item.schema';
import { Testimonial, TestimonialSchema } from '../testimonials/schemas/testimonial.schema';
import { Gallery, GallerySchema } from '../galleries/schemas/gallery.schema';

const ADAPTER_PROVIDERS = [
  TouristSiteAdapter,
  HistoricalFigureAdapter,
  CityAdapter,
  MemoryAdapter,
  TestimonialAdapter,
  GalleryAdapter,
];

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RagChunk.name, schema: RagChunkSchema },
      { name: ChatSession.name, schema: ChatSessionSchema },
      { name: TouristSite.name, schema: TouristSiteSchema },
      { name: HistoricalFigure.name, schema: HistoricalFigureSchema },
      { name: City.name, schema: CitySchema },
      { name: MemoryItem.name, schema: MemoryItemSchema },
      { name: Testimonial.name, schema: TestimonialSchema },
      { name: Gallery.name, schema: GallerySchema },
    ]),
  ],
  controllers: [RagController],
  providers: [
    RagIngestionService,
    RagRetrievalService,
    RagChatService,
    ...ADAPTER_PROVIDERS,
    {
      // Permet à RagIngestionService de recevoir la liste de tous les adapters
      // sans les connaître individuellement (voir son constructeur)
      provide: 'RAG_SOURCE_ADAPTERS',
      useFactory: (...adapters) => adapters,
      inject: ADAPTER_PROVIDERS,
    },
  ],
  exports: [RagIngestionService],
})
export class RagModule {}
