import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CitiesModule } from '../cities/cities.module';
import { GalleriesController } from './galleries.controller';
import { GalleriesService } from './galleries.service';
import { Gallery, GallerySchema } from './schemas/gallery.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Gallery.name, schema: GallerySchema }]),
    CitiesModule,
  ],
  controllers: [GalleriesController],
  providers: [GalleriesService],
  exports: [GalleriesService],
})
export class GalleriesModule {}
