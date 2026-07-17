import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';
import { MediaOwnerType, MediaType } from '../../common/enums/media.enum';

export class CreateMediaDto {
  @ApiProperty({ example: 'Vue aérienne de la ville' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Photo prise au coucher du soleil.' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ enum: MediaType, example: MediaType.IMAGE })
  @IsEnum(MediaType)
  type: MediaType;

  @ApiProperty({ example: 'https://cdn.cultureplus.bj/media/ouidah.jpg' })
  @IsUrl()
  url: string;

  @ApiPropertyOptional({
    example: 'cultureplusbenin/abc123',
    description:
      'Cloudinary public id (returned by POST /media/upload). Enables asset deletion on remove.',
  })
  @IsOptional()
  @IsString()
  publicId?: string;

  @ApiProperty({
    enum: MediaOwnerType,
    example: MediaOwnerType.CITY,
    description: 'Kind of resource this media is attached to',
  })
  @IsEnum(MediaOwnerType)
  ownerType: MediaOwnerType;

  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description:
      'Id of the resource (city, tourist site, gallery or historical figure) this media belongs to',
  })
  @IsMongoId()
  owner: string;
}
