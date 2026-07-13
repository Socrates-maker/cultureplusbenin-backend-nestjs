import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { City, CitySchema } from '../cities/schemas/city.schema';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [
    // The aggregation starts on the City model; every other collection is
    // reached through `$unionWith`, so no other module import is needed.
    MongooseModule.forFeature([{ name: City.name, schema: CitySchema }]),
  ],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
