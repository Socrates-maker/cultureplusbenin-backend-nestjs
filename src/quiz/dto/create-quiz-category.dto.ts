import { IsOptional, IsString } from 'class-validator';

export class CreateQuizCategoryDto {
  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;
}
