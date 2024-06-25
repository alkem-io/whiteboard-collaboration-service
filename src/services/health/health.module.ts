import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { WhiteboardIntegrationModule } from '../whiteboard-integration/whiteboard.integration.module';

@Module({
  imports: [WhiteboardIntegrationModule],
  controllers: [HealthController],
})
export class HealthModule {}
