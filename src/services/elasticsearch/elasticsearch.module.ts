import { Module } from '@nestjs/common';
import { ElasticsearchClientProvider } from '../../elasticsearch-client';
import { ElasticsearchService } from './elasticsearch.service';

@Module({
  imports: [],
  providers: [ElasticsearchClientProvider, ElasticsearchService],
  exports: [ElasticsearchService],
})
export class ElasticsearchModule {}
