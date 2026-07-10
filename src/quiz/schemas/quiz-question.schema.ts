import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type QuizQuestionDocument = HydratedDocument<QuizQuestion>;

export enum QuizDifficulty {
  FACILE = 'facile',
  INTERMEDIAIRE = 'intermediaire',
  EXPERT = 'expert',
}

@Schema({ _id: true })
export class QuizOption {
  _id?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  label: string;

  @Prop({ required: true, default: false })
  isCorrect: boolean;

  @Prop({ default: 0 })
  order: number;
}

@Schema({ timestamps: true })
export class QuizQuestion {
  @Prop({ required: true, trim: true })
  question: string;

  @Prop({ required: true, trim: true })
  feedback: string;

  @Prop({ required: true, enum: QuizDifficulty, type: String })
  difficulty: QuizDifficulty;

  @Prop({ type: Types.ObjectId, ref: 'QuizCategory' })
  categoryId?: Types.ObjectId;

  @Prop({
    type: [QuizOption],
    required: true,
    validate: [
      (v: QuizOption[]) => Array.isArray(v) && v.length >= 2,
      'Au moins 2 options requises',
    ],
  })
  options: QuizOption[];

  @Prop({ default: true })
  isPublished: boolean;
}

export const QuizQuestionSchema = SchemaFactory.createForClass(QuizQuestion);

QuizQuestionSchema.index({ difficulty: 1, isPublished: 1 });
