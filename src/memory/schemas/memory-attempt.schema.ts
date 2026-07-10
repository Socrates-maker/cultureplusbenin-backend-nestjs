import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { MemoryDifficulty } from './memory-item.schema';

export type MemoryAttemptDocument = HydratedDocument<MemoryAttempt>;

@Schema({ timestamps: true })
export class MemoryAttempt {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: [Types.ObjectId], ref: 'MemoryItem', required: true })
  itemIds: Types.ObjectId[];

  @Prop({ required: true })
  totalPairs: number;

  @Prop({ required: true })
  flips: number;

  @Prop({ required: true })
  score: number;

  @Prop({ enum: MemoryDifficulty, type: String })
  difficulty?: MemoryDifficulty;
}

export const MemoryAttemptSchema = SchemaFactory.createForClass(MemoryAttempt);
