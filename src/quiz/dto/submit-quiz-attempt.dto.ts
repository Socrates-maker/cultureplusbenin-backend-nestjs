import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsMongoId,
  ValidateNested,
} from 'class-validator';
import { QuizDifficulty } from '../schemas/quiz-question.schema';
import { ApiProperty } from '@nestjs/swagger';

class AnswerEntryDto {
  @IsMongoId()
  @ApiProperty({ description: 'The ID of the question being answered' })
  questionId: string;

  @IsMongoId()
  @ApiProperty({ description: 'The ID of the selected option' })
  optionId: string;
}

export class SubmitQuizAttemptDto {
  @IsEnum(QuizDifficulty)
  @ApiProperty({ enum: QuizDifficulty, example: QuizDifficulty.FACILE })
  difficulty: QuizDifficulty;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AnswerEntryDto)
  @ApiProperty({
    type: [AnswerEntryDto],
    description: 'Array of answers submitted by the user',
  })
  answers: AnswerEntryDto[];
}
