import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { GalleryOwnerType } from '../../common/enums/gallery.enum';

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

  // Polymorphic owner: a gallery belongs to either a City or a TouristSite.
  @Prop({ type: String, enum: GalleryOwnerType, required: true, index: true })
  ownerType: GalleryOwnerType;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    required: true,
    refPath: 'ownerType',
    index: true,
  })
  owner: Types.ObjectId;

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
