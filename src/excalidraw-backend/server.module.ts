import { Module } from '@nestjs/common';
import { UtilModule } from '../services/util/util.module';
import { WhiteboardIntegrationModule } from '../services/whiteboard-integration/whiteboard.integration.module';
import { Server } from './server';

@Module({
  imports: [WhiteboardIntegrationModule, UtilModule],
  providers: [Server],
})
export class ServerModule {}
