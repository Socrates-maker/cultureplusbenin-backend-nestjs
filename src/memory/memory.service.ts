import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateMemoryItemDto } from './dto/create-memory-item.dto';
import { GetMemoryItemsDto } from './dto/get-memory-items.dto';
import { MemoryItemResponseDto } from './dto/memory-item-response.dto';
import { SubmitMemoryAttemptDto } from './dto/submit-memory-attempt.dto';
import { UpdateMemoryItemDto } from './dto/update-memory-item.dto';
import {
  MemoryAttempt,
  MemoryAttemptDocument,
} from './schemas/memory-attempt.schema';
import {
  MemoryDifficulty,
  MemoryItem,
  MemoryItemDocument,
} from './schemas/memory-item.schema';
import {
  UserMemoryBestScore,
  UserMemoryBestScoreDocument,
} from './schemas/user-memory-best-score.schema';

interface MemoryItemAggregate {
  _id: Types.ObjectId;
  name: string;
  image: string;
}

@Injectable()
export class MemoryService {
  constructor(
    @InjectModel(MemoryItem.name)
    private readonly memoryItemModel: Model<MemoryItemDocument>,
    @InjectModel(MemoryAttempt.name)
    private readonly memoryAttemptModel: Model<MemoryAttemptDocument>,
    @InjectModel(UserMemoryBestScore.name)
    private readonly userMemoryBestScoreModel: Model<UserMemoryBestScoreDocument>,
  ) {}

  async getItems(dto: GetMemoryItemsDto): Promise<MemoryItemResponseDto[]> {
    const match: {
      isPublished: boolean;
      categoryId?: Types.ObjectId;
      difficulty?: MemoryDifficulty;
    } = {
      isPublished: true,
    };

    if (dto.categoryId) {
      match.categoryId = new Types.ObjectId(dto.categoryId);
    }
    if (dto.difficulty) {
      match.difficulty = dto.difficulty;
    }

    const limit = dto.limit ?? 8;
    const docs = await this.memoryItemModel
      .aggregate<MemoryItemAggregate>([
        { $match: match },
        { $sample: { size: limit } },
      ])
      .exec();

    return docs.map((doc) => this.toItemResponse(doc));
  }

  async submitAttempt(userId: string, dto: SubmitMemoryAttemptDto) {
    const uniqueItemIds = Array.from(new Set(dto.itemIds)).map(
      (id) => new Types.ObjectId(id),
    );

    const items = await this.memoryItemModel
      .find({ _id: { $in: uniqueItemIds }, isPublished: true })
      .exec();

    if (items.length !== uniqueItemIds.length) {
      throw new BadRequestException('One or more memory items are invalid');
    }

    const totalPairs = dto.itemIds.length;
    const score = Math.min(
      100,
      Math.round(((totalPairs * 2) / dto.flips) * 100),
    );

    await this.memoryAttemptModel.create({
      userId: new Types.ObjectId(userId),
      itemIds: dto.itemIds.map((itemId) => new Types.ObjectId(itemId)),
      totalPairs,
      flips: dto.flips,
      score,
      difficulty: dto.difficulty,
    });

    const bestScoreRecord = await this.upsertBestScore(userId, score, dto.flips);

    return {
      score,
      totalPairs,
      flips: dto.flips,
      isNewBest: bestScoreRecord.isNewBest,
      bestScore: bestScoreRecord.bestScore,
    };
  }

  async getBestScore(userId: string) {
    const entry = await this.userMemoryBestScoreModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();

    if (!entry) {
      return {
        bestScore: 0,
        bestFlips: 0,
        playedCount: 0,
      };
    }

    return {
      bestScore: entry.bestScore,
      bestFlips: entry.bestFlips,
      playedCount: entry.playedCount,
    };
  }

  async getLeaderboard(limit = 10) {
    const cappedLimit = Math.max(1, Math.min(100, Number(limit) || 10));
    const leaderboard = await this.userMemoryBestScoreModel
      .find()
      .sort({ bestScore: -1, bestFlips: 1, updatedAt: 1 })
      .limit(cappedLimit)
      .populate({
        path: 'userId',
        select: 'firstname lastname email',
      })
      .exec();

    return leaderboard.map((entry, index) => ({
      rank: index + 1,
      user: {
        id: entry.userId?._id?.toString?.() ?? '',
        firstname: entry.userId?.['firstname'] ?? null,
        lastname: entry.userId?.['lastname'] ?? null,
        email: entry.userId?.['email'] ?? null,
      },
      bestScore: entry.bestScore,
      bestFlips: entry.bestFlips,
      playedCount: entry.playedCount,
    }));
  }

  async createItem(dto: CreateMemoryItemDto): Promise<MemoryItemDocument> {
    return new this.memoryItemModel({
      ...dto,
      categoryId: dto.categoryId ? new Types.ObjectId(dto.categoryId) : undefined,
      difficulty: dto.difficulty ?? MemoryDifficulty.FACILE,
      isPublished: dto.isPublished ?? true,
    }).save();
  }

  async updateItem(id: string, dto: UpdateMemoryItemDto): Promise<MemoryItemDocument> {
    const item = await this.memoryItemModel.findById(id).exec();
    if (!item) {
      throw new NotFoundException('Memory item not found');
    }

    if (dto.name !== undefined) item.name = dto.name;
    if (dto.image !== undefined) item.image = dto.image;
    if (dto.difficulty !== undefined) item.difficulty = dto.difficulty;
    if (dto.categoryId !== undefined) {
      item.categoryId = dto.categoryId ? new Types.ObjectId(dto.categoryId) : undefined;
    }
    if (dto.isPublished !== undefined) item.isPublished = dto.isPublished;

    return item.save();
  }

  async deleteItem(id: string): Promise<void> {
    const res = await this.memoryItemModel.deleteOne({ _id: id }).exec();
    if (res.deletedCount === 0) {
      throw new NotFoundException('Memory item not found');
    }
  }

  async listItems(query: {
    page?: number;
    limit?: number;
    difficulty?: MemoryDifficulty;
    categoryId?: string;
    isPublished?: boolean;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter: {
      difficulty?: MemoryDifficulty;
      categoryId?: Types.ObjectId;
      isPublished?: boolean;
    } = {};

    if (query.difficulty) {
      filter.difficulty = query.difficulty;
    }
    if (query.categoryId) {
      filter.categoryId = new Types.ObjectId(query.categoryId);
    }
    if (query.isPublished !== undefined) {
      filter.isPublished = query.isPublished;
    }

    const [items, total] = await Promise.all([
      this.memoryItemModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.memoryItemModel.countDocuments(filter).exec(),
    ]);

    return {
      data: items.map((item) => ({
        id: item._id.toString(),
        name: item.name,
        image: item.image,
        categoryId: item.categoryId?.toString() ?? null,
        difficulty: item.difficulty,
        isPublished: item.isPublished,
      })),
      page,
      limit,
      total,
    };
  }

  async seedItems() {
    const seedData = [
      { name: 'Kpanlogo', image: 'https://.../kpanlogo.jpg' },
      { name: 'Gèlèdé', image: 'https://.../gelede.jpg' },
      { name: 'Wax', image: 'https://.../wax.jpg' },
      { name: 'Djembé', image: 'https://.../djembe.jpg' },
      { name: 'Recade royal', image: 'https://.../recade.jpg' },
      { name: 'Case en banco', image: 'https://.../banco.jpg' },
    ];

    const existing = await this.memoryItemModel
      .find({ name: { $in: seedData.map((item) => item.name) } })
      .select('name')
      .lean()
      .exec();

    const existingNames = new Set(existing.map((item) => item.name));
    const toInsert = seedData.filter((item) => !existingNames.has(item.name));

    if (toInsert.length > 0) {
      await this.memoryItemModel.insertMany(toInsert);
    }

    return {
      inserted: toInsert.length,
      skipped: seedData.length - toInsert.length,
      totalSeed: seedData.length,
    };
  }

  private async upsertBestScore(userId: string, score: number, flips: number) {
    const filter = {
      userId: new Types.ObjectId(userId),
    };

    const entry = await this.userMemoryBestScoreModel.findOne(filter).exec();
    if (!entry) {
      const created = await this.userMemoryBestScoreModel.create({
        ...filter,
        bestScore: score,
        bestFlips: flips,
        playedCount: 1,
      });
      return { isNewBest: true, bestScore: created.bestScore };
    }

    entry.playedCount += 1;
    let isNewBest = false;
    if (score > entry.bestScore || (score === entry.bestScore && flips < entry.bestFlips)) {
      entry.bestScore = score;
      entry.bestFlips = flips;
      isNewBest = true;
    }

    await entry.save();
    return { isNewBest, bestScore: entry.bestScore };
  }

  private toItemResponse(doc: MemoryItemAggregate): MemoryItemResponseDto {
    return {
      id: doc._id.toString(),
      name: doc.name,
      image: doc.image,
    };
  }
}
