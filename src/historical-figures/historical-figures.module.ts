import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CitiesModule } from '../cities/cities.module';
import { HistoricalFiguresController } from './historical-figures.controller';
import { HistoricalFiguresService } from './historical-figures.service';
import {
  HistoricalFigure,
  HistoricalFigureSchema,
} from './schemas/historical-figure.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HistoricalFigure.name, schema: HistoricalFigureSchema },
    ]),
    CitiesModule,
  ],
  controllers: [HistoricalFiguresController],
  providers: [HistoricalFiguresService],
  exports: [HistoricalFiguresService],
})
export class HistoricalFiguresModule {}
