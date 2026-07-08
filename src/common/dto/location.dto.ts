import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsLatitude, IsLongitude, IsOptional, IsString } from 'class-validator';

export class LocationDto {
  @ApiPropertyOptional({ example: 'Cotonou, Littoral, Bénin' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ example: 6.3703 })
  @IsLatitude()
  latitude: number;

  @ApiProperty({ example: 2.3912 })
  @IsLongitude()
  longitude: number;
}
