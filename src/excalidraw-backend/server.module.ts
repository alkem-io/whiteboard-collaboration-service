import { Module } from '@nestjs/common';
import { WhiteboardIntegrationModule } from '../services/whiteboard-integration/whiteboard.integration.module';
import { UtilModule } from '../services/util/util.module';
import { Server } from './server';
import { ContributionTrackingService } from './contribution.tracking.service';

@Module({
  imports: [WhiteboardIntegrationModule, UtilModule],
  exports: [Server, ContributionTrackingService],
  providers: [Server, ContributionTrackingService],
})
export class ServerModule {}
