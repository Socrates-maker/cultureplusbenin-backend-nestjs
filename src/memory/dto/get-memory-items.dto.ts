import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsMongoId, IsOptional, Max, Min } from 'class-validator';
import { MemoryDifficulty } from '../schemas/memory-item.schema';
import { ApiProperty } from '@nestjs/swagger';

export class GetMemoryItemsDto {
  @IsOptional()
  @IsMongoId()
  @ApiProperty({ description: 'The ID of the category to filter memory items by', example: '507f1f77bcf86cd799439011' })
  categoryId?: string;

  @IsOptional()
  @IsEnum(MemoryDifficulty)
  @ApiProperty({ description: 'The difficulty level to filter memory items by', example: 'facile' })
  difficulty?: MemoryDifficulty;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(4)
  @Max(12)
  @ApiProperty({ description: 'The maximum number of memory items to retrieve', example: 8, default: 8 })
  limit?: number = 8;
}
