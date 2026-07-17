import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { QuizDifficulty } from '../schemas/quiz-question.schema';

class QuizOptionDto {
  @IsString()
  label: string;

  @IsBoolean()
  isCorrect: boolean;
}

export class CreateQuizQuestionDto {
  @IsString()
  question: string;

  @IsString()
  feedback: string;

  @IsEnum(QuizDifficulty)
  difficulty: QuizDifficulty;

  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => QuizOptionDto)
  options: QuizOptionDto[];

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
