import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { TagsField } from '../../common/decorators/tags-field.decorator';
import { StoryCategory } from '../../common/enums/story.enum';

export class CreateStoryDto {
  @ApiProperty({ example: 'La résistance de Béhanzin' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: 'Comment le dernier roi du Dahomey affronta la colonisation.',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    example:
      'En 1890, les troupes françaises débarquèrent à Cotonou. Béhanzin…',
    description: 'Full body of the story (free text)',
  })
  @IsString()
  @IsNotEmpty()
  body: string;

  @ApiProperty({ enum: StoryCategory, example: StoryCategory.RESISTANCE })
  @IsEnum(StoryCategory)
  category: StoryCategory;

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439011',
    description: 'Id of the city this story relates to',
  })
  @IsOptional()
  @IsMongoId()
  city?: string;

  @TagsField()
  tags?: string[];
}
