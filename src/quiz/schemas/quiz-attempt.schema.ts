import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { QuizDifficulty } from './quiz-question.schema';

export type QuizAttemptDocument = HydratedDocument<QuizAttempt>;

@Schema()
export class QuizAnswerEntry {
  @Prop({ type: Types.ObjectId, ref: 'QuizQuestion', required: true })
  questionId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true })
  optionId: Types.ObjectId;
}

@Schema({ timestamps: true })
export class QuizAttempt {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: QuizDifficulty, type: String })
  difficulty: QuizDifficulty;

  @Prop({ required: true })
  score: number;

  @Prop({ required: true })
  total: number;

  @Prop({ type: [QuizAnswerEntry], required: true })
  answers: QuizAnswerEntry[];
}

export const QuizAttemptSchema = SchemaFactory.createForClass(QuizAttempt);
