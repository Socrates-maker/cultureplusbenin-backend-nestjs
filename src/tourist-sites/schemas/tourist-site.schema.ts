import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { ModerationStatus } from '../../common/enums/moderation-status.enum';
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

  // Moderation state. User submissions start PENDING and are only publicly
  // visible once an admin approves them; editor/admin submissions are APPROVED.
  @Prop({
    type: String,
    enum: ModerationStatus,
    default: ModerationStatus.PENDING,
    index: true,
  })
  status: ModerationStatus;

  // Admin who last reviewed this submission (approve / reject).
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  reviewedBy?: Types.ObjectId;

  @Prop()
  reviewedAt?: Date;

  // Reason given when a submission is rejected (optional).
  @Prop()
  rejectionReason?: string;

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
