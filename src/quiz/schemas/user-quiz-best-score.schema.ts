import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { QuizDifficulty } from './quiz-question.schema';

export type UserQuizBestScoreDocument = HydratedDocument<UserQuizBestScore>;

@Schema({ timestamps: true })
export class UserQuizBestScore {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: QuizDifficulty, type: String })
  difficulty: QuizDifficulty;

  @Prop({ required: true })
  bestScore: number;

  @Prop({ required: true })
  bestTotal: number;

  @Prop({ default: 0 })
  playedCount: number;
}

export const UserQuizBestScoreSchema =
  SchemaFactory.createForClass(UserQuizBestScore);

UserQuizBestScoreSchema.index({ userId: 1, difficulty: 1 }, { unique: true });
