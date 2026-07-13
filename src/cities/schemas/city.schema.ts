import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { Location, LocationSchema } from '../../common/schemas/location.schema';

export type CityDocument = HydratedDocument<City>;

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class City {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true })
  description: string;

  // Historical background of the city (free text, optional).
  @Prop()
  history?: string;

  @Prop({ type: LocationSchema, required: true })
  location: Location;

  // Free-form filtering tags, stored normalized (trimmed lowercase, deduped).
  @Prop({ type: [String], index: true, default: undefined })
  tags?: string[];

  // Owner of the record — used by CASL to authorize updates/deletes.
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ default: false })
  deleted: boolean;
}

export const CitySchema = SchemaFactory.createForClass(City);

// Virtual relation to the media (images / videos / audios) of this city.
CitySchema.virtual('media', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'owner',
  match: { ownerType: 'City', deleted: false },
});

// Virtual relation to the galleries attached to this city.
CitySchema.virtual('galleries', {
  ref: 'Gallery',
  localField: '_id',
  foreignField: 'owner',
  match: { ownerType: 'City', deleted: false },
});
