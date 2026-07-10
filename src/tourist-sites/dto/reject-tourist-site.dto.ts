import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RejectTouristSiteDto {
  @ApiPropertyOptional({
    example: 'Les informations fournies ne sont pas vérifiables.',
    description: 'Raison du rejet (communiquée au contributeur).',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
