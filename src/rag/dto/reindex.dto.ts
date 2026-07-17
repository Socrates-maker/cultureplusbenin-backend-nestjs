import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { RagSourceType } from '../rag.constants';

export class ReindexParamsDto {
  @ApiProperty({ enum: RagSourceType })
  @IsEnum(RagSourceType)
  sourceType: RagSourceType;
}

export class ReindexResultDto {
  @ApiProperty() sourceType: RagSourceType;
  @ApiProperty() indexed: number;
  @ApiProperty() skipped: number;
}

export class IndexStatusDto {
  @ApiProperty({ description: 'Nombre de chunks indexés par type de source' })
  countsBySourceType: Record<string, number>;

  @ApiProperty() totalChunks: number;
}
