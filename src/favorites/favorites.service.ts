import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { RequestUser } from '../casl/casl-ability.factory';
import { FavoriteItemType } from '../common/enums/favorite.enum';
import {
  PageOptions,
  Paginated,
  paginate,
} from '../common/utils/pagination.util';
import { CreateFavoriteDto } from './dto/create-favorite.dto';
import { Favorite, FavoriteDocument } from './schemas/favorite.schema';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectModel(Favorite.name)
    private readonly favoriteModel: Model<FavoriteDocument>,
    // Used to resolve the favorited entity's model dynamically (the enum
    // values are Mongoose model names), avoiding a dependency on six modules.
    @InjectConnection() private readonly connection: Connection,
  ) {}

  /** Bookmark an entity. Idempotent: re-adding returns the existing favorite. */
  async add(user: RequestUser, dto: CreateFavoriteDto): Promise<FavoriteDocument> {
    await this.assertItemExists(dto.itemType, dto.item);
    return this.favoriteModel
      .findOneAndUpdate(
        { user: user.userId, itemType: dto.itemType, item: dto.item },
        { $setOnInsert: { user: user.userId, ...dto } },
        { upsert: true, returnDocument: 'after' },
      )
      .exec();
  }

  /** The caller's favorites, newest first, optionally filtered by type. */
  findMine(
    user: RequestUser,
    itemType?: FavoriteItemType,
    pagination: PageOptions = {},
  ): Promise<Paginated<FavoriteDocument>> {
    const filter: Record<string, unknown> = { user: user.userId };
    if (itemType) {
      filter.itemType = itemType;
    }
    return paginate<FavoriteDocument>(this.favoriteModel, filter, pagination, {
      populate: ['item'],
    });
  }

  /** Remove a bookmark. Idempotent: removing a non-favorite is a no-op. */
  async remove(
    user: RequestUser,
    itemType: FavoriteItemType,
    itemId: string,
  ): Promise<void> {
    await this.favoriteModel
      .deleteOne({ user: user.userId, itemType, item: itemId })
      .exec();
  }

  /** The favorited entity must exist (and not be soft-deleted). */
  private async assertItemExists(
    itemType: FavoriteItemType,
    itemId: string,
  ): Promise<void> {
    const model = this.connection.models[itemType];
    if (!model) {
      throw new BadRequestException(`Unknown favorite type: ${itemType}`);
    }
    const exists = await model
      .exists({ _id: itemId, deleted: { $ne: true } })
      .exec();
    if (!exists) {
      throw new NotFoundException(`${itemType} not found`);
    }
  }
}
