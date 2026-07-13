import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TagsField } from '../../common/decorators/tags-field.decorator';

export class CreateTraditionDto {
  @ApiProperty({ example: 'La fête de la Gaani' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: 'Célébration annuelle de la cour royale de Nikki.',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({
    example: 'Héritée de la dynastie des Wassangari…',
    description: 'Origin of the tradition (free text)',
  })
  @IsOptional()
  @IsString()
  origin?: string;

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439011',
    description: 'Id of the city this tradition relates to',
  })
  @IsOptional()
  @IsMongoId()
  city?: string;

  @TagsField()
  tags?: string[];
}
