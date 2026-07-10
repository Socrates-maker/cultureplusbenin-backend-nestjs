import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type QuizCategoryDocument = HydratedDocument<QuizCategory>;

@Schema({ timestamps: true })
export class QuizCategory {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  slug: string;

  @Prop({ trim: true })
  description?: string;
}

export const QuizCategorySchema = SchemaFactory.createForClass(QuizCategory);