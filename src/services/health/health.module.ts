import { Module } from '@nestjs/common';
import { ServerModule } from '../../excalidraw-backend/server.module';
import { WhiteboardIntegrationModule } from '../whiteboard-integration/whiteboard.integration.module';
import { HealthController } from './health.controller';

@Module({
  imports: [WhiteboardIntegrationModule, ServerModule],
  controllers: [HealthController],
})
export class HealthModule {}
