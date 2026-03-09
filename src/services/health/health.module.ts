import { Module } from '@nestjs/common';
import { WhiteboardIntegrationModule } from '../whiteboard-integration/whiteboard.integration.module';
import { HealthController } from './health.controller';

@Module({
  imports: [WhiteboardIntegrationModule],
  controllers: [HealthController],
})
export class HealthModule {}
