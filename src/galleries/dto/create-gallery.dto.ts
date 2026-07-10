import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsMongoId, IsNotEmpty, IsString } from 'class-validator';
import { GalleryOwnerType } from '../../common/enums/gallery.enum';

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
    enum: GalleryOwnerType,
    example: GalleryOwnerType.TOURIST_SITE,
    description: 'Type of entity this gallery belongs to',
  })
  @IsEnum(GalleryOwnerType)
  ownerType: GalleryOwnerType;

  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'Id of the City or TouristSite this gallery belongs to',
  })
  @IsMongoId()
  owner: string;
}
