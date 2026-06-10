import { Module } from '@nestjs/common';
import { UtilModule } from '../services/util/util.module';
import { WhiteboardIntegrationModule } from '../services/whiteboard-integration/whiteboard.integration.module';
import { Server } from './server';
import { WhiteboardCollaborationController } from './whiteboard.collaboration.controller';

@Module({
  imports: [WhiteboardIntegrationModule, UtilModule],
  controllers: [WhiteboardCollaborationController],
  providers: [Server],
})
export class ServerModule {}
