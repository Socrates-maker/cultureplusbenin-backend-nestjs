import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type EventDocument = HydratedDocument<Event>;

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Event {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true })
  description: string;

  // Origin of the event (free text, optional).
  @Prop()
  origin?: string;

  // Date the event takes place.
  @Prop({ required: true, index: true })
  date: Date;

  // The city this event relates to (optional).
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

export const EventSchema = SchemaFactory.createForClass(Event);

// Weighted French text index backing GET /search (see SearchService).
EventSchema.index(
  { title: 'text', tags: 'text', description: 'text', origin: 'text' },
  {
    name: 'event_text_search',
    weights: { title: 10, tags: 5, description: 3, origin: 1 },
    default_language: 'french',
  },
);

// Virtual relation to the media (images / videos / audios) of this event.
EventSchema.virtual('media', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'owner',
  match: { ownerType: 'Event', deleted: false },
});

// Virtual relation to the galleries attached to this event.
EventSchema.virtual('galleries', {
  ref: 'Gallery',
  localField: '_id',
  foreignField: 'owner',
  match: { ownerType: 'Event', deleted: false },
});
