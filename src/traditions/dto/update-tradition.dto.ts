import { PartialType } from '@nestjs/swagger';
import { CreateTraditionDto } from './create-tradition.dto';

export class UpdateTraditionDto extends PartialType(CreateTraditionDto) {}
