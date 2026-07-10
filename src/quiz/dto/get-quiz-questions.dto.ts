import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsMongoId, IsOptional, Max, Min } from 'class-validator';
import { QuizDifficulty } from '../schemas/quiz-question.schema';

export class GetQuizQuestionsDto {
  @IsEnum(QuizDifficulty)
  difficulty: QuizDifficulty;

  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  limit?: number = 10;
}
