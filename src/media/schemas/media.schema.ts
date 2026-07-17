import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { MediaOwnerType, MediaType } from '../../common/enums/media.enum';

export type MediaDocument = HydratedDocument<Media>;

@Schema({ timestamps: true })
export class Media {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({ type: String, enum: MediaType, required: true })
  type: MediaType;

  @Prop({ required: true })
  url: string;

  // Cloudinary public id, set when the file was uploaded to Cloudinary.
  // Kept so the asset can be removed from Cloudinary later.
  @Prop()
  publicId?: string;

  // Polymorphic owner: a media belongs to either a City or a TouristSite.
  @Prop({ type: String, enum: MediaOwnerType, required: true })
  ownerType: MediaOwnerType;

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

export const MediaSchema = SchemaFactory.createForClass(Media);
