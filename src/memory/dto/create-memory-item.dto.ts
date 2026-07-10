import { IsEnum, IsMongoId, IsOptional, IsString, IsUrl } from 'class-validator';
import { MemoryDifficulty } from '../schemas/memory-item.schema';
import { ApiProperty } from '@nestjs/swagger';

export class CreateMemoryItemDto {
  @IsString()
  @ApiProperty({ description: 'The name of the memory item', example: 'Apple' })
  name: string;

  @IsUrl()
  @ApiProperty({ description: 'The URL of the memory item image', example: 'https://example.com/image.jpg' })
  image: string;

  @IsOptional()
  @IsMongoId()
  @ApiProperty({ description: 'The ID of the category to which the memory item belongs', example: '507f1f77bcf86cd799439011' })
  categoryId?: string;

  @IsOptional()
  @IsEnum(MemoryDifficulty)
  @ApiProperty({ description: 'The difficulty level of the memory item', example: 'facile' })
  difficulty?: MemoryDifficulty;
}
