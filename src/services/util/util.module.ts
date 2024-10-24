import { Module } from '@nestjs/common';
import { WhiteboardIntegrationModule } from '../whiteboard-integration/whiteboard.integration.module';
import { ElasticsearchClientProvider } from '../../elasticsearch-client';
import { ElasticsearchModule } from '../elasticsearch/elasticsearch.module';
import { UtilService } from './util.service';

@Module({
  imports: [WhiteboardIntegrationModule, ElasticsearchModule],
  providers: [UtilService, ElasticsearchClientProvider],
  exports: [UtilService],
})
export class UtilModule {}
