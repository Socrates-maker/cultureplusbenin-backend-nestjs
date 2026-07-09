import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type GalleryDocument = HydratedDocument<Gallery>;

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Gallery {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true })
  description: string;

  // The city this gallery belongs to.
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'City',
    required: true,
    index: true,
  })
  city: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ default: false })
  deleted: boolean;
}

export const GallerySchema = SchemaFactory.createForClass(Gallery);

// Virtual relation to the media (images / videos / audios) of this gallery.
GallerySchema.virtual('media', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'owner',
  match: { ownerType: 'Gallery', deleted: false },
});
