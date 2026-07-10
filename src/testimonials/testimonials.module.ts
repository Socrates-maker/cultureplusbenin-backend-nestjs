import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CitiesModule } from '../cities/cities.module';
import { HistoricalFiguresModule } from '../historical-figures/historical-figures.module';
import { Media, MediaSchema } from '../media/schemas/media.schema';
import { TouristSitesModule } from '../tourist-sites/tourist-sites.module';
import { TestimonialsController } from './testimonials.controller';
import { TestimonialsService } from './testimonials.service';
import {
  Testimonial,
  TestimonialSchema,
} from './schemas/testimonial.schema';

@Module({
  imports: [
    // The Media model is registered here (not MediaModule) so testimonials can
    // validate their cover / media references without depending on MediaModule
    // — MediaModule depends on this module, and that would be a cycle.
    MongooseModule.forFeature([
      { name: Testimonial.name, schema: TestimonialSchema },
      { name: Media.name, schema: MediaSchema },
    ]),
    CitiesModule,
    TouristSitesModule,
    HistoricalFiguresModule,
  ],
  controllers: [TestimonialsController],
  providers: [TestimonialsService],
  exports: [TestimonialsService],
})
export class TestimonialsModule {}
