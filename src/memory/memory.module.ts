import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MemoryAdminController } from './memory-admin.controller';
import { MemoryController } from './memory.controller';
import { MemoryService } from './memory.service';
import {
  MemoryAttempt,
  MemoryAttemptSchema,
} from './schemas/memory-attempt.schema';
import { MemoryItem, MemoryItemSchema } from './schemas/memory-item.schema';
import {
  UserMemoryBestScore,
  UserMemoryBestScoreSchema,
} from './schemas/user-memory-best-score.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MemoryItem.name, schema: MemoryItemSchema },
      { name: MemoryAttempt.name, schema: MemoryAttemptSchema },
      { name: UserMemoryBestScore.name, schema: UserMemoryBestScoreSchema },
    ]),
  ],
  controllers: [MemoryController, MemoryAdminController],
  providers: [MemoryService],
  exports: [MemoryService],
})
export class MemoryModule {}
