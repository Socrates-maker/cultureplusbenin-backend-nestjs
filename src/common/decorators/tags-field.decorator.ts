import { applyDecorators } from '@nestjs/common';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { normalizeTags } from '../utils/tags.util';

/**
 * Optional free-form `tags` DTO field, shared by every taggable resource.
 * Tags are normalized (trimmed, lowercased, deduplicated) during validation
 * so the database only ever stores canonical values.
 */
export function TagsField() {
  return applyDecorators(
    ApiPropertyOptional({
      type: [String],
      example: ['vaudou', 'histoire'],
      description:
        'Free-form tags used for filtering (trimmed, lowercased and deduplicated)',
    }),
    IsOptional(),
    Transform(({ value }: { value: unknown }) =>
      Array.isArray(value) ? normalizeTags(value as string[]) : value,
    ),
    IsArray(),
    IsString({ each: true }),
    MaxLength(30, { each: true }),
    ArrayMaxSize(20),
  );
}
