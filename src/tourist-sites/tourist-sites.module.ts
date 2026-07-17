import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CitiesModule } from '../cities/cities.module';
import { TouristSite, TouristSiteSchema } from './schemas/tourist-site.schema';
import { TouristSitesController } from './tourist-sites.controller';
import { TouristSitesService } from './tourist-sites.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TouristSite.name, schema: TouristSiteSchema },
    ]),
    CitiesModule,
  ],
  controllers: [TouristSitesController],
  providers: [TouristSitesService],
  exports: [TouristSitesService],
})
export class TouristSitesModule {}
