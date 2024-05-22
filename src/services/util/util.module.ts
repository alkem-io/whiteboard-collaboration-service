import { Module } from '@nestjs/common';
import { WhiteboardIntegrationModule } from '../whiteboard-integration/whiteboard.integration.module';
import { UtilService } from './util.service';

@Module({
  imports: [WhiteboardIntegrationModule],
  providers: [UtilService],
  exports: [UtilService],
})
export class UtilModule {}
