import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RagSourceAdapter, RagIngestableDocument } from '../interfaces/rag-source-adapter.interface';
import { RagSourceType } from '../rag.constants';
import {
  HistoricalFigure,
  HistoricalFigureDocument,
} from '../../historical-figures/schemas/historical-figure.schema';

@Injectable()
export class HistoricalFigureAdapter implements RagSourceAdapter {
  readonly sourceType = RagSourceType.HISTORICAL_FIGURE;

  constructor(
    @InjectModel(HistoricalFigure.name)
    private readonly model: Model<HistoricalFigureDocument>,
  ) {}

  async fetchOne(id: string): Promise<RagIngestableDocument | null> {
    const doc = await this.model.findOne({ _id: id, deleted: false }).populate('city').lean();
    if (!doc) return null;
    return this.toIngestable(doc);
  }

  async fetchAll(): Promise<RagIngestableDocument[]> {
    const docs = await this.model.find({ deleted: false }).populate('city').lean();
    return docs.map((d) => this.toIngestable(d));
  }

  private toIngestable(doc: any): RagIngestableDocument {
    const fullText = [
      doc.name,
      doc.city?.name,
      doc.description,
      doc.biography,
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
        category: 'historical-figure',
        tags: doc.tags ?? [],
      },
      mediaUrls: doc.portraitUrl ? [doc.portraitUrl] : [],
    };
  }
}
