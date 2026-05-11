import { Controller, Get, Header, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Server as ExcalidrawServer } from '../../excalidraw-backend/server';
import { WhiteboardIntegrationService } from '../whiteboard-integration/whiteboard.integration.service';

type CheckStatus = 'up' | 'down' | 'unknown';

type HealthReport = {
  status: 'healthy' | 'unhealthy';
  uptimeSeconds: number;
  checks: {
    process: CheckStatus;
    wsEngine: CheckStatus;
    rmq: CheckStatus;
  };
  observed: {
    connectedSockets: number;
  };
};

// IETF "Health Check Response Format for HTTP APIs"-aligned shape (subset).
// Liveness/readiness for the whiteboard collaboration service.
// Returns 503 if any critical check fails
@Controller('/health')
export class HealthController {
  private readonly bootedAt = Date.now();

  constructor(
    private readonly integrationService: WhiteboardIntegrationService,
    private readonly server: ExcalidrawServer,
  ) {}

  @Get('/')
  @Header('Cache-Control', 'no-store')
  public async healthCheck(@Res() res: Response): Promise<void> {
    const wsEngine: CheckStatus = this.server.isWsReady() ? 'up' : 'down';
    const rmq: CheckStatus = (await this.integrationService.isConnected())
      ? 'up'
      : 'down';

    const allCriticalUp = wsEngine === 'up' && rmq === 'up';

    const report: HealthReport = {
      status: allCriticalUp ? 'healthy' : 'unhealthy',
      uptimeSeconds: Math.floor((Date.now() - this.bootedAt) / 1000),
      checks: {
        process: 'up', // we are responding → process is up
        wsEngine,
        rmq,
      },
      observed: {
        connectedSockets: this.server.connectedSocketCount(),
      },
    };

    res
      .status(allCriticalUp ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
      .json(report);
  }
}
