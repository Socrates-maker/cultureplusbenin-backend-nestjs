import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { Location, LocationSchema } from '../../common/schemas/location.schema';

export type TouristSiteDocument = HydratedDocument<TouristSite>;

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class TouristSite {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true })
  description: string;

  // Historical background of the tourist site (free text, optional).
  @Prop()
  history?: string;

  @Prop({ type: LocationSchema, required: true })
  location: Location;

  // The city this tourist site belongs to.
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

export const TouristSiteSchema = SchemaFactory.createForClass(TouristSite);

// Virtual relation to the media (images / videos / audios) of this site.
TouristSiteSchema.virtual('media', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'owner',
  match: { ownerType: 'TouristSite', deleted: false },
});
