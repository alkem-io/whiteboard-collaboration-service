import { Module } from '@nestjs/common';
import { WhiteboardIntegrationModule } from '../whiteboard-integration/whiteboard.integration.module';
import { UtilService } from './util.service';
import { ElasticsearchClientProvider } from '../../elasticsearch-client';

@Module({
  imports: [WhiteboardIntegrationModule],
  providers: [UtilService, ElasticsearchClientProvider],
  exports: [UtilService],
})
export class UtilModule {}
