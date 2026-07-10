import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsMongoId,
  ValidateNested,
} from 'class-validator';
import { QuizDifficulty } from '../schemas/quiz-question.schema';

class AnswerEntryDto {
  @IsMongoId()
  questionId: string;

  @IsMongoId()
  optionId: string;
}

export class SubmitQuizAttemptDto {
  @IsEnum(QuizDifficulty)
  difficulty: QuizDifficulty;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AnswerEntryDto)
  answers: AnswerEntryDto[];
}
