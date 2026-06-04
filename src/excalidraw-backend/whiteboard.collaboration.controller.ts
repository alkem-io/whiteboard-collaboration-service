import { Controller, Inject, LoggerService } from '@nestjs/common';
import { EventPattern, Payload, Transport } from '@nestjs/microservices';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { WhiteboardIntegrationEventPattern } from '../services/whiteboard-integration/event.pattern.enum';
import { Server } from './server';

type ContentUpdatedExternallyData = {
  whiteboardId: string;
};

/**
 * Inbound RMQ listener (server -> this service). Consumes the
 * `contentUpdatedExternally` event the server emits after a direct content write
 * (e.g. the MCP `update_whiteboard_content` tool) and asks the Excalidraw server
 * to reload the affected room from the DB and push the new scene to live editors.
 *
 * This is the FIRST inbound microservice listener in this service; everything
 * else here is an outbound ClientProxy (request/response towards the server).
 */
@Controller()
export class WhiteboardCollaborationController {
  constructor(
    private readonly server: Server,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService,
  ) {}

  @EventPattern(
    WhiteboardIntegrationEventPattern.CONTENT_UPDATED_EXTERNALLY,
    Transport.RMQ,
  )
  async contentUpdatedExternally(
    @Payload() data: ContentUpdatedExternallyData,
  ): Promise<void> {
    const whiteboardId = data?.whiteboardId;
    if (!whiteboardId) {
      this.logger.warn?.(
        'Received contentUpdatedExternally event without a whiteboardId',
      );
      return;
    }

    this.logger.verbose?.(
      `Received contentUpdatedExternally for whiteboard '${whiteboardId}' - reloading room from store`,
    );

    try {
      await this.server.reloadRoomFromStore(whiteboardId);
    } catch (e: any) {
      this.logger.error?.(
        `Failed to reload room '${whiteboardId}' from store: ${e?.message}`,
        e?.stack,
      );
    }
  }
}
