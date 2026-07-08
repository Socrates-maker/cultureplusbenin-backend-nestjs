import { PartialType } from '@nestjs/swagger';
import { CreateTouristSiteDto } from './create-tourist-site.dto';

export class UpdateTouristSiteDto extends PartialType(CreateTouristSiteDto) {}
