import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CitiesModule } from '../cities/cities.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { GalleriesModule } from '../galleries/galleries.module';
import { HistoricalFiguresModule } from '../historical-figures/historical-figures.module';
import { TestimonialsModule } from '../testimonials/testimonials.module';
import { TouristSitesModule } from '../tourist-sites/tourist-sites.module';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { Media, MediaSchema } from './schemas/media.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Media.name, schema: MediaSchema }]),
    CitiesModule,
    TouristSitesModule,
    GalleriesModule,
    HistoricalFiguresModule,
    TestimonialsModule,
    CloudinaryModule,
  ],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
