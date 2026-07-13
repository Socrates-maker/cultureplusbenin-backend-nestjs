import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { StoryCategory } from '../../common/enums/story.enum';

export type StoryDocument = HydratedDocument<Story>;

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Story {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true })
  description: string;

  // Full body of the story (free text).
  @Prop({ required: true })
  body: string;

  @Prop({ type: String, enum: StoryCategory, required: true, index: true })
  category: StoryCategory;

  // The city this story relates to (optional).
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

export const StorySchema = SchemaFactory.createForClass(Story);

// Virtual relation to the media (images / videos / audios) of this story.
StorySchema.virtual('media', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'owner',
  match: { ownerType: 'Story', deleted: false },
});

// Virtual relation to the galleries attached to this story.
StorySchema.virtual('galleries', {
  ref: 'Gallery',
  localField: '_id',
  foreignField: 'owner',
  match: { ownerType: 'Story', deleted: false },
});
