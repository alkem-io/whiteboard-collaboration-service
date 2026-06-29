import { Controller, Inject, LoggerService } from '@nestjs/common';
import {
  Ctx,
  EventPattern,
  Payload,
  RmqContext,
  Transport,
} from '@nestjs/microservices';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { ExcalidrawElement } from '../excalidraw/types/excalidraw.element';
import { ExcalidrawFileStore } from '../excalidraw/types/excalidraw.file';
import { WhiteboardIntegrationEventPattern } from '../services/whiteboard-integration/event.pattern.enum';
import { Server } from './server';

type ContentUpdatedExternallyData = {
  whiteboardId: string;
  /**
   * Optional element delta the external writer applied: the elements it
   * changed/added plus delete tombstones, ideally already version-bumped. When
   * present, the collaboration server merges it as a normal collaborator update;
   * when absent it falls back to a safe full-DB reconcile.
   * See {@link Server.applyExternalContentUpdate}.
   */
  elements?: readonly ExcalidrawElement[];
  files?: ExcalidrawFileStore;
};

/**
 * Inbound RMQ listener (server -> this service). Consumes the
 * `contentUpdatedExternally` event the server emits after a direct content write
 * (e.g. the MCP `update_whiteboard_content` tool) and merges it into the affected
 * OPEN room through the normal collaborator reconcile + broadcast path, so live
 * editors see the change without losing their in-flight edits.
 *
 * This is the FIRST inbound microservice listener in this service; everything
 * else here is an outbound ClientProxy (request/response towards the server).
 */
@Controller()
export class WhiteboardCollaborationController {
  constructor(
    private readonly server: Server,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  @EventPattern(
    WhiteboardIntegrationEventPattern.CONTENT_UPDATED_EXTERNALLY,
    Transport.RMQ,
  )
  async contentUpdatedExternally(
    @Payload() data: ContentUpdatedExternallyData,
    @Ctx() context: RmqContext,
  ): Promise<void> {
    const channel = context.getChannelRef();
    const message = context.getMessage();

    const whiteboardId = data?.whiteboardId;
    if (!whiteboardId) {
      // Malformed event — ack to drop it; requeuing would loop forever.
      this.logger.warn?.(
        'Received contentUpdatedExternally event without a whiteboardId - dropping',
      );
      channel.ack(message);
      return;
    }

    // RMQ at-least-once: a redelivery (failed first attempt or a crash before ack)
    // re-runs this handler with the SAME delta. Don't re-stamp it to win on the
    // retry, so a stale duplicate is reconciled by its original versions and can't
    // clobber a newer live edit that landed in between.
    const redelivered = message?.fields?.redelivered === true;

    this.logger.verbose?.(
      `Received contentUpdatedExternally for whiteboard '${whiteboardId}' - merging external content into live room`,
    );

    try {
      await this.server.applyExternalContentUpdate(
        whiteboardId,
        {
          elements: data.elements,
          files: data.files,
        },
        { restampDelta: !redelivered },
      );
      channel.ack(message);
    } catch (e: any) {
      // Manual ack with a single bounded retry: a transient failure (DB/save) is
      // requeued ONCE; a second failure (already redelivered) is acked so a poison
      // message cannot loop. The DB write is authoritative, so the worst case is
      // the live push is dropped and the editor sees the change on the next reload.
      if (redelivered) {
        this.logger.error?.(
          `Failed to apply external content update to room '${whiteboardId}' after retry - dropping: ${e?.message}`,
          e?.stack,
        );
        channel.ack(message);
      } else {
        this.logger.warn?.(
          `Failed to apply external content update to room '${whiteboardId}' - requeuing for one retry: ${e?.message}`,
        );
        channel.nack(message, false, true);
      }
    }
  }
}
