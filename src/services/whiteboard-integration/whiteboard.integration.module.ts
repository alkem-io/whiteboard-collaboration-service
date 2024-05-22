import { Module } from '@nestjs/common';
import { WhiteboardIntegrationService } from './whiteboard.integration.service';
import { WhiteboardIntegrationAdapterService } from './whiteboard.integration.adapter.service';

@Module({
  providers: [
    WhiteboardIntegrationService,
    WhiteboardIntegrationAdapterService,
  ],
  exports: [WhiteboardIntegrationService],
})
export class WhiteboardIntegrationModule {}
