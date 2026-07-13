import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';
import { FavoriteItemType } from '../../common/enums/favorite.enum';

export type FavoriteDocument = HydratedDocument<Favorite>;

@Schema({ timestamps: true })
export class Favorite {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  user: Types.ObjectId;

  // Polymorphic bookmark: the kind of entity being favorited.
  @Prop({ type: String, enum: FavoriteItemType, required: true })
  itemType: FavoriteItemType;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    required: true,
    refPath: 'itemType',
  })
  item: Types.ObjectId;
}

export const FavoriteSchema = SchemaFactory.createForClass(Favorite);

// A user can favorite a given entity only once.
FavoriteSchema.index({ user: 1, itemType: 1, item: 1 }, { unique: true });
