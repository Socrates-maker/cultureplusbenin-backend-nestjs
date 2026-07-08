import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { LocationDto } from '../../common/dto/location.dto';

export class CreateTouristSiteDto {
  @ApiProperty({ example: 'La Porte du Non-Retour' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Monument mémoriel sur la plage de Ouidah.' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({
    example:
      "Érigée au XIXe siècle, la Porte du Non-Retour commémore les déportés de la traite négrière.",
    description: 'Historique du site touristique (texte libre).',
  })
  @IsOptional()
  @IsString()
  history?: string;

  @ApiProperty({ type: LocationDto })
  @ValidateNested()
  @Type(() => LocationDto)
  location: LocationDto;

  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'Id of the city this site belongs to',
  })
  @IsMongoId()
  city: string;
}
