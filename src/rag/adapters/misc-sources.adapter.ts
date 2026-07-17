import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RagSourceAdapter, RagIngestableDocument } from '../interfaces/rag-source-adapter.interface';
import { RagSourceType } from '../rag.constants';
import { City, CityDocument } from '../../cities/schemas/city.schema';
import { MemoryItem, MemoryItemDocument } from '../../memory/schemas/memory-item.schema';
import { ModerationStatus } from '../../common/enums/moderation-status.enum';
import { Testimonial, TestimonialDocument } from '../../testimonials/schemas/testimonial.schema';
import { Gallery, GalleryDocument } from '../../galleries/schemas/gallery.schema';

@Injectable()
export class CityAdapter implements RagSourceAdapter {
  readonly sourceType = RagSourceType.CITY;
  constructor(@InjectModel(City.name) private readonly model: Model<CityDocument>) {}

  async fetchOne(id: string) {
    const doc = await this.model.findOne({ _id: id, deleted: false }).lean();
    return doc ? this.toIngestable(doc) : null;
  }
  async fetchAll() {
    const docs = await this.model.find({ deleted: false }).lean();
    return docs.map((d) => this.toIngestable(d));
  }
  private toIngestable(doc: any): RagIngestableDocument {
    return {
      sourceId: doc._id.toString(),
      sourceType: this.sourceType,
      sourceTitle: doc.name,
      fullText: [doc.name, doc.description, doc.history].filter(Boolean).join('\n\n'),
      metadata: { cityId: doc._id.toString(), cityName: doc.name, category: 'city', tags: [] },
      mediaUrls: doc.images ?? [],
    };
  }
}

@Injectable()
export class MemoryAdapter implements RagSourceAdapter {
  readonly sourceType = RagSourceType.MEMORY;
  constructor(@InjectModel(MemoryItem.name) private readonly model: Model<MemoryItemDocument>) {}

  async fetchOne(id: string) {
    const doc = await this.model.findOne({ _id: id, isPublished: true }).lean();
    return doc ? this.toIngestable(doc) : null;
  }
  async fetchAll() {
    const docs = await this.model.find({ isPublished: true }).lean();
    return docs.map((d) => this.toIngestable(d));
  }
  private toIngestable(doc: any): RagIngestableDocument {
    return {
      sourceId: doc._id.toString(),
      sourceType: this.sourceType,
      sourceTitle: doc.name,
      fullText: [doc.name, `Difficulté: ${doc.difficulty}`].join('\n\n'),
      metadata: { category: 'memory-item', tags: [doc.difficulty] },
      mediaUrls: doc.images ?? [],
    };
  }
}

@Injectable()
export class TestimonialAdapter implements RagSourceAdapter {
  readonly sourceType = RagSourceType.TESTIMONIAL;
  constructor(@InjectModel(Testimonial.name) private readonly model: Model<TestimonialDocument>) {}

  async fetchOne(id: string) {
    const doc = await this.model
      .findOne({ _id: id, deleted: false, status: ModerationStatus.APPROVED })
      .lean();
    return doc ? this.toIngestable(doc) : null;
  }
  // IMPORTANT: n'indexer que les témoignages modérés/approuvés (contenu généré par les utilisateurs)
  async fetchAll() {
    const docs = await this.model
      .find({ deleted: false, status: ModerationStatus.APPROVED })
      .lean();
    return docs.map((d) => this.toIngestable(d));
  }
  private toIngestable(doc: any): RagIngestableDocument {
    return {
      sourceId: doc._id.toString(),
      sourceType: this.sourceType,
      sourceTitle: doc.title ?? 'Témoignage',
      fullText: [doc.title, doc.description].filter(Boolean).join('\n\n'),
      metadata: { category: doc.subjectType, tags: [doc.subjectType] },
      mediaUrls: [],
    };
  }
}

@Injectable()
export class GalleryAdapter implements RagSourceAdapter {
  readonly sourceType = RagSourceType.GALLERY;
  constructor(@InjectModel(Gallery.name) private readonly model: Model<GalleryDocument>) {}

  async fetchOne(id: string) {
    const doc = await this.model.findOne({ _id: id, deleted: false }).lean();
    return doc ? this.toIngestable(doc) : null;
  }
  async fetchAll() {
    const docs = await this.model.find({ deleted: false }).lean();
    return docs.map((d) => this.toIngestable(d));
  }
  private toIngestable(doc: any): RagIngestableDocument {
    return {
      sourceId: doc._id.toString(),
      sourceType: this.sourceType,
      sourceTitle: doc.name ?? 'Galerie',
      fullText: [doc.name, doc.description].filter(Boolean).join('\n\n'),
      metadata: { category: doc.ownerType, tags: [doc.ownerType] },
      mediaUrls: doc.imageUrl ? [doc.imageUrl] : (doc.images ?? []),
    };
  }
}
