import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CitiesModule } from '../cities/cities.module';
import { TraditionsController } from './traditions.controller';
import { TraditionsService } from './traditions.service';
import { Tradition, TraditionSchema } from './schemas/tradition.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tradition.name, schema: TraditionSchema },
    ]),
    CitiesModule,
  ],
  controllers: [TraditionsController],
  providers: [TraditionsService],
  exports: [TraditionsService],
})
export class TraditionsModule {}
