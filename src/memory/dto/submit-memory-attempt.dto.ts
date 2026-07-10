import { IsArray, IsEnum, IsInt, IsMongoId, IsOptional, ArrayMinSize, Min } from 'class-validator';
import { MemoryDifficulty } from '../schemas/memory-item.schema';
import { ApiProperty } from '@nestjs/swagger';

export class SubmitMemoryAttemptDto {
  @IsArray()
  @ArrayMinSize(2)
  @IsMongoId({ each: true })
  @ApiProperty({ description: 'The IDs of the memory items attempted' })
  itemIds: string[];

  @IsInt()
  @Min(1)
  @ApiProperty({ description: 'The number of flips made during the attempt', example: 10 })
  flips: number;

  @IsOptional()
  @IsEnum(MemoryDifficulty)
  @ApiProperty({ description: 'The difficulty level of the attempt', example: 'facile' })
  difficulty?: MemoryDifficulty;
}
