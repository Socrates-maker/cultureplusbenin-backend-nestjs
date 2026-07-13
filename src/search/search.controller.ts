import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SearchQueryDto } from './dto/search-query.dto';
import { SearchService } from './search.service';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({
    summary:
      'Global search across communes, tourist sites, historical figures, stories, traditions and events (public content only), ranked by relevance',
  })
  search(@Query() query: SearchQueryDto) {
    return this.searchService.search(query.q, query.limit);
  }
}
