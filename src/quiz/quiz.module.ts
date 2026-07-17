import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { QuizAdminController } from './quiz-admin.controller';
import { QuizController } from './quiz.controller';
import { QuizService } from './quiz.service';
import { QuizAttempt, QuizAttemptSchema } from './schemas/quiz-attempt.schema';
import {
  QuizCategory,
  QuizCategorySchema,
} from './schemas/quiz-category.schema';
import {
  QuizQuestion,
  QuizQuestionSchema,
} from './schemas/quiz-question.schema';
import {
  UserQuizBestScore,
  UserQuizBestScoreSchema,
} from './schemas/user-quiz-best-score.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: QuizCategory.name, schema: QuizCategorySchema },
      { name: QuizQuestion.name, schema: QuizQuestionSchema },
      { name: QuizAttempt.name, schema: QuizAttemptSchema },
      { name: UserQuizBestScore.name, schema: UserQuizBestScoreSchema },
    ]),
  ],
  controllers: [QuizController, QuizAdminController],
  providers: [QuizService],
  exports: [QuizService],
})
export class QuizModule {}