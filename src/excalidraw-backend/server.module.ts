import { Module } from '@nestjs/common';
import { WhiteboardIntegrationModule } from '../services/whiteboard-integration/whiteboard.integration.module';
import { UtilModule } from '../services/util/util.module';
import { Server } from './server';

@Module({
  imports: [WhiteboardIntegrationModule, UtilModule],
  exports: [Server],
  providers: [Server],
})
export class ServerModule {}
