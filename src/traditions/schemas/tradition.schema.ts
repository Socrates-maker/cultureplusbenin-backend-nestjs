import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type TraditionDocument = HydratedDocument<Tradition>;

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Tradition {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true })
  description: string;

  // Origin of the tradition (free text, optional).
  @Prop()
  origin?: string;

  // The city this tradition relates to (optional).
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'City',
    index: true,
  })
  city?: Types.ObjectId;

  // Free-form filtering tags, stored normalized (trimmed lowercase, deduped).
  @Prop({ type: [String], index: true, default: undefined })
  tags?: string[];

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ default: false })
  deleted: boolean;
}

export const TraditionSchema = SchemaFactory.createForClass(Tradition);

// Weighted French text index backing GET /search (see SearchService).
TraditionSchema.index(
  { title: 'text', tags: 'text', description: 'text', origin: 'text' },
  {
    name: 'tradition_text_search',
    weights: { title: 10, tags: 5, description: 3, origin: 1 },
    default_language: 'french',
  },
);

// Virtual relation to the media (images / videos / audios) of this tradition.
TraditionSchema.virtual('media', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'owner',
  match: { ownerType: 'Tradition', deleted: false },
});

// Virtual relation to the galleries attached to this tradition.
TraditionSchema.virtual('galleries', {
  ref: 'Gallery',
  localField: '_id',
  foreignField: 'owner',
  match: { ownerType: 'Tradition', deleted: false },
});
