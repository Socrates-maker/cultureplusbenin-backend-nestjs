import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { ModerationStatus } from '../../common/enums/moderation-status.enum';
import { TestimonialSubjectType } from '../../common/enums/testimonial.enum';

export type TestimonialDocument = HydratedDocument<Testimonial>;

@Schema({
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
})
export class Testimonial {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true })
  description: string;

  // What the testimonial is about: a place (city), a tourist site or a
  // historical figure. Polymorphic reference driven by `subjectType`.
  @Prop({
    type: String,
    enum: TestimonialSubjectType,
    required: true,
    index: true,
  })
  subjectType: TestimonialSubjectType;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    required: true,
    refPath: 'subjectType',
    index: true,
  })
  subject: Types.ObjectId;

  // Cover photo: an image Media owned by this testimonial. Optional at creation
  // — the media are uploaded and attached once the testimonial exists.
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Media' })
  coverMedia?: Types.ObjectId;

  // The testimonial itself: a video or audio Media owned by this testimonial.
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Media' })
  media?: Types.ObjectId;

  // Free-form filtering tags, stored normalized (trimmed lowercase, deduped).
  @Prop({ type: [String], index: true, default: undefined })
  tags?: string[];

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

export const TestimonialSchema = SchemaFactory.createForClass(Testimonial);
