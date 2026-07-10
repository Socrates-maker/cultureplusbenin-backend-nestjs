import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MemoryItemDocument = HydratedDocument<MemoryItem>;

export enum MemoryDifficulty {
  FACILE = 'facile',
  INTERMEDIAIRE = 'intermediaire',
  EXPERT = 'expert',
}

@Schema({ timestamps: true })
export class MemoryItem {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  image: string;

  @Prop({ type: Types.ObjectId, ref: 'MemoryCategory' })
  categoryId?: Types.ObjectId;

  @Prop({ enum: MemoryDifficulty, type: String, default: MemoryDifficulty.FACILE })
  difficulty: MemoryDifficulty;

  @Prop({ default: true })
  isPublished: boolean;
}

export const MemoryItemSchema = SchemaFactory.createForClass(MemoryItem);

MemoryItemSchema.index({ difficulty: 1, isPublished: 1 });
