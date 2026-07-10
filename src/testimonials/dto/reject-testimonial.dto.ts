import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RejectTestimonialDto {
  @ApiPropertyOptional({
    example: 'Le témoignage n’est pas relié à la personnalité indiquée.',
    description: 'Raison du rejet (communiquée au contributeur).',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
