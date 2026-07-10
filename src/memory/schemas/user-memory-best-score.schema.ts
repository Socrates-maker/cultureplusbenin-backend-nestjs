import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserMemoryBestScoreDocument = HydratedDocument<UserMemoryBestScore>;

@Schema({ timestamps: true })
export class UserMemoryBestScore {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  bestScore: number;

  @Prop({ required: true })
  bestFlips: number;

  @Prop({ default: 0 })
  playedCount: number;
}

export const UserMemoryBestScoreSchema = SchemaFactory.createForClass(UserMemoryBestScore);

UserMemoryBestScoreSchema.index({ userId: 1 }, { unique: true });
