import { Module } from '@nestjs/common';
import { WhiteboardIntegrationAdapterService } from './whiteboard.integration.adapter.service';
import { WhiteboardIntegrationService } from './whiteboard.integration.service';

@Module({
  providers: [
    WhiteboardIntegrationService,
    WhiteboardIntegrationAdapterService,
  ],
  exports: [WhiteboardIntegrationService],
})
export class WhiteboardIntegrationModule {}
