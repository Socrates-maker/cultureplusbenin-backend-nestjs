import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsMongoId, IsOptional, Max, Min } from 'class-validator';
import { QuizDifficulty } from '../schemas/quiz-question.schema';
import { ApiProperty } from '@nestjs/swagger';

export class GetQuizQuestionsDto {
  @ApiProperty({ enum: QuizDifficulty, example: QuizDifficulty.FACILE })
  @IsEnum(QuizDifficulty)
  difficulty: QuizDifficulty;

  @IsOptional()
  @IsMongoId()
  @ApiProperty({ description: 'Optional category ID to filter questions' })
  categoryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  @ApiProperty({ description: 'Number of questions to return', example: 10 })
  limit?: number = 10;
}
