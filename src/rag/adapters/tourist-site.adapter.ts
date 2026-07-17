import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RagSourceAdapter, RagIngestableDocument } from '../interfaces/rag-source-adapter.interface';
import { RagSourceType } from '../rag.constants';
import { ModerationStatus } from '../../common/enums/moderation-status.enum';
import { TouristSite, TouristSiteDocument } from '../../tourist-sites/schemas/tourist-site.schema';

@Injectable()
export class TouristSiteAdapter implements RagSourceAdapter {
  readonly sourceType = RagSourceType.TOURIST_SITE;

  constructor(
    @InjectModel(TouristSite.name)
    private readonly touristSiteModel: Model<TouristSiteDocument>,
  ) {}

  async fetchOne(id: string): Promise<RagIngestableDocument | null> {
    const doc = await this.touristSiteModel
      .findOne({ _id: id, deleted: false, status: ModerationStatus.APPROVED })
      .populate('city')
      .lean();
    if (!doc) return null;
    return this.toIngestable(doc);
  }

  async fetchAll(): Promise<RagIngestableDocument[]> {
    const docs = await this.touristSiteModel
      .find({ deleted: false, status: ModerationStatus.APPROVED })
      .populate('city')
      .lean();
    return docs.map((d) => this.toIngestable(d));
  }

  private toIngestable(doc: any): RagIngestableDocument {
    const fullText = [
      doc.name,
      doc.description,
      doc.history,
      doc.location?.address,
      doc.city?.name,
    ]
      .filter(Boolean)
      .join('\n\n');

    return {
      sourceId: doc._id.toString(),
      sourceType: this.sourceType,
      sourceTitle: doc.name,
      fullText,
      metadata: {
        cityId: doc.city?._id?.toString(),
        cityName: doc.city?.name,
        category: 'tourist-site',
        tags: doc.tags ?? [],
      },
      mediaUrls: doc.images ?? [],
    };
  }
}
