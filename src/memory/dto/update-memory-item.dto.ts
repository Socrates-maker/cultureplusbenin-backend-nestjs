import { PartialType } from '@nestjs/swagger';
import { CreateMemoryItemDto } from './create-memory-item.dto';

export class UpdateMemoryItemDto extends PartialType(CreateMemoryItemDto) {}
