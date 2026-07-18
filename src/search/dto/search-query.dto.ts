import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export const SEARCH_RESULT_TYPES = [
  'city',
  'touristSite',
  'historicalFigure',
  'story',
  'tradition',
  'event',
] as const;

export type SearchResultTypeName = (typeof SEARCH_RESULT_TYPES)[number];

export class SearchQueryDto {
  @ApiProperty({
    example: 'ouidah',
    description: 'Free text searched across every public content type',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(2)
  q: string;

  @ApiPropertyOptional({
    description: 'Maximum number of results returned overall',
    default: 20,
    minimum: 1,
    maximum: 50,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @ApiPropertyOptional({
    description:
      'Comma-separated result types to restrict the search to (contextual search). Omitted = all types.',
    example: 'tradition,event',
    enum: SEARCH_RESULT_TYPES,
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : value,
  )
  @IsIn(SEARCH_RESULT_TYPES, { each: true })
  types?: SearchResultTypeName[];
}
