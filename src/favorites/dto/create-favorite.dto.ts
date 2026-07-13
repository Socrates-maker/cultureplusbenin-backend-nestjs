import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsMongoId } from 'class-validator';
import { FavoriteItemType } from '../../common/enums/favorite.enum';

export class CreateFavoriteDto {
  @ApiProperty({
    enum: FavoriteItemType,
    example: FavoriteItemType.TOURIST_SITE,
    description: 'Kind of entity being favorited',
  })
  @IsEnum(FavoriteItemType)
  itemType: FavoriteItemType;

  @ApiProperty({
    example: '507f1f77bcf86cd799439011',
    description: 'Id of the favorited entity',
  })
  @IsMongoId()
  item: string;
}
