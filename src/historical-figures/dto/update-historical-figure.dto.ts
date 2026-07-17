import { PartialType } from '@nestjs/swagger';
import { CreateHistoricalFigureDto } from './create-historical-figure.dto';

export class UpdateHistoricalFigureDto extends PartialType(
  CreateHistoricalFigureDto,
) {}
