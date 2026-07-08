import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CitiesModule } from '../cities/cities.module';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import { TouristSitesModule } from '../tourist-sites/tourist-sites.module';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { Media, MediaSchema } from './schemas/media.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Media.name, schema: MediaSchema }]),
    CitiesModule,
    TouristSitesModule,
    CloudinaryModule,
  ],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
