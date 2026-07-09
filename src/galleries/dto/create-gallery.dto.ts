import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId, IsNotEmpty, IsString } from 'class-validator';

export class CreateGalleryDto {
  @ApiProperty({ example: 'Galerie des masques Guèlèdè' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Collection de masques traditionnels du sud Bénin.' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'Id of the city this gallery belongs to',
  })
  @IsMongoId()
  city: string;
}
