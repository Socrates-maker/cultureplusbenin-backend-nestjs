import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { LocationDto } from '../../common/dto/location.dto';

export class CreateCityDto {
  @ApiProperty({ example: 'Ouidah' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Ville historique de la côte béninoise.' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({
    example: 'Fondée au XVIIe siècle, Ouidah fut un port majeur de la traite.',
    description: 'Historique de la ville (texte libre).',
  })
  @IsOptional()
  @IsString()
  history?: string;

  @ApiProperty({ type: LocationDto })
  @ValidateNested()
  @Type(() => LocationDto)
  location: LocationDto;
}
