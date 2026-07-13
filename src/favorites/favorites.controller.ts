import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseEnumPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { RequestUser } from '../casl/casl-ability.factory';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { FavoriteItemType } from '../common/enums/favorite.enum';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { FavoritesService } from './favorites.service';

@ApiTags('favorites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  @ApiOperation({
    summary: "List the caller's favorites, optionally filtered by type",
  })
  @ApiQuery({ name: 'itemType', required: false, enum: FavoriteItemType })
  findMine(
    @CurrentUser() user: RequestUser,
    @Query() pagination: PaginationQueryDto,
    @Query('itemType', new ParseEnumPipe(FavoriteItemType, { optional: true }))
    itemType?: FavoriteItemType,
  ) {
    return this.favoritesService.findMine(user, itemType, pagination);
  }

  @Post()
  @ApiOperation({
    summary: 'Favorite an entity (idempotent: re-adding is a no-op)',
  })
  add(@CurrentUser() user: RequestUser, @Body() dto: CreateFavoriteDto) {
    return this.favoritesService.add(user, dto);
  }

  @Delete(':itemType/:itemId')
  @HttpCode(204)
  @ApiOperation({
    summary: 'Unfavorite an entity (idempotent: removing a non-favorite is a no-op)',
  })
  remove(
    @CurrentUser() user: RequestUser,
    @Param('itemType', new ParseEnumPipe(FavoriteItemType))
    itemType: FavoriteItemType,
    @Param('itemId') itemId: string,
  ) {
    return this.favoritesService.remove(user, itemType, itemId);
  }
}
