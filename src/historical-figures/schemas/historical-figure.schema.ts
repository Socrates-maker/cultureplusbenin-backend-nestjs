import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type HistoricalFigureDocument = HydratedDocument<HistoricalFigure>;

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class HistoricalFigure {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true })
  description: string;

  // Full biography of the figure (free text, optional).
  @Prop()
  biography?: string;

  // The city this historical figure is attached to.
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'City',
    required: true,
    index: true,
  })
  city: Types.ObjectId;

  // Free-form filtering tags, stored normalized (trimmed lowercase, deduped).
  @Prop({ type: [String], index: true, default: undefined })
  tags?: string[];

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ default: false })
  deleted: boolean;
}

export const HistoricalFigureSchema =
  SchemaFactory.createForClass(HistoricalFigure);

// Weighted French text index backing GET /search (see SearchService).
HistoricalFigureSchema.index(
  { name: 'text', tags: 'text', description: 'text', biography: 'text' },
  {
    name: 'historical_figure_text_search',
    weights: { name: 10, tags: 5, description: 3, biography: 1 },
    default_language: 'french',
  },
);

// Virtual relation to the media (images / videos / audios) of this figure.
HistoricalFigureSchema.virtual('media', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'owner',
  match: { ownerType: 'HistoricalFigure', deleted: false },
});
