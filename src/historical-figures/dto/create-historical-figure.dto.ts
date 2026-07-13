import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TagsField } from '../../common/decorators/tags-field.decorator';

export class CreateHistoricalFigureDto {
  @ApiProperty({ example: 'Béhanzin' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Dernier roi indépendant du Dahomey.' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({
    example:
      "Roi du Dahomey de 1889 à 1894, Béhanzin mena la résistance contre la colonisation française.",
    description: 'Biographie de la figure historique (texte libre).',
  })
  @IsOptional()
  @IsString()
  biography?: string;

  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'Id of the city this historical figure is attached to',
  })
  @IsMongoId()
  city: string;

  @TagsField()
  tags?: string[];
}
