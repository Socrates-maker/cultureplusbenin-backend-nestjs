import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { TagsField } from '../../common/decorators/tags-field.decorator';

export class CreateEventDto {
  @ApiProperty({ example: 'Festival des masques Guèlèdè' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({
    example: 'Rassemblement annuel des masques Guèlèdè à Kétou.',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({
    example: 'Tradition yoruba-nago classée par l’UNESCO…',
    description: 'Origin of the event (free text)',
  })
  @IsOptional()
  @IsString()
  origin?: string;

  @ApiProperty({ example: '2026-08-15' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({
    example: '507f1f77bcf86cd799439011',
    description: 'Id of the city this event relates to',
  })
  @IsOptional()
  @IsMongoId()
  city?: string;

  @TagsField()
  tags?: string[];
}
