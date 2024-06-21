import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { WhiteboardIntegrationService } from '../whiteboard-integration/whiteboard.integration.service';

@Controller('/health')
export class HealthController {
  constructor(
    private readonly integrationService: WhiteboardIntegrationService,
  ) {}
  @Get('/')
  public async healthCheck(): Promise<string> {
    if (!(await this.integrationService.isConnected())) {
      throw new HttpException('unhealthy!', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return 'healthy!';
  }
}
