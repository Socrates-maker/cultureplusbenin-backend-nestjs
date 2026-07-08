import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Model } from 'mongoose';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserDocument } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async create(dto: CreateUserDto): Promise<UserDocument> {
    const existing = await this.userModel
      .findOne({ email: dto.email.toLowerCase() })
      .exec();
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    const password = await bcrypt.hash(dto.password, 10);
    const user = new this.userModel({ ...dto, password });
    return user.save();
  }

  findAll(): Promise<UserDocument[]> {
    return this.userModel.find({ deleted: false }).exec();
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel
      .findOne({ _id: id, deleted: false })
      .exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /** Includes the password field — used by the auth layer only. */
  findByEmailWithPassword(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase(), deleted: false })
      .select('+password')
      .exec();
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserDocument> {
    const user = await this.userModel
      .findOneAndUpdate({ _id: id, deleted: false }, dto, { new: true })
      .exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /** Soft delete — flips the `deleted` flag instead of removing the record. */
  async remove(id: string): Promise<void> {
    const res = await this.userModel
      .updateOne({ _id: id, deleted: false }, { deleted: true })
      .exec();
    if (res.matchedCount === 0) {
      throw new NotFoundException('User not found');
    }
  }
}
