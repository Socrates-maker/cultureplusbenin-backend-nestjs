import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CitiesModule } from '../cities/cities.module';
import { EventsModule } from '../events/events.module';
import { StoriesModule } from '../stories/stories.module';
import { TouristSitesModule } from '../tourist-sites/tourist-sites.module';
import { TraditionsModule } from '../traditions/traditions.module';
import { GalleriesController } from './galleries.controller';
import { GalleriesService } from './galleries.service';
import { Gallery, GallerySchema } from './schemas/gallery.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Gallery.name, schema: GallerySchema }]),
    CitiesModule,
    TouristSitesModule,
    StoriesModule,
    TraditionsModule,
    EventsModule,
  ],
  controllers: [GalleriesController],
  providers: [GalleriesService],
  exports: [GalleriesService],
})
export class GalleriesModule {}
