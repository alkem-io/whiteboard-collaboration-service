import { WhiteboardCollaborationController } from './whiteboard.collaboration.controller';

const makeCtx = (redelivered = false) => {
  const channel = { ack: jest.fn(), nack: jest.fn() };
  const message = { fields: { redelivered } };
  const ctx: any = {
    getChannelRef: () => channel,
    getMessage: () => message,
  };
  return { ctx, channel, message };
};

const build = () => {
  const server = {
    applyExternalContentUpdate: jest.fn().mockResolvedValue(undefined),
  };
  const logger = { verbose: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const controller = new WhiteboardCollaborationController(
    server as any,
    logger as any,
  );
  return { controller, server };
};

describe('WhiteboardCollaborationController.contentUpdatedExternally', () => {
  it('merges (re-stamping) then acks on a first delivery', async () => {
    const { controller, server } = build();
    const { ctx, channel } = makeCtx(false);

    await controller.contentUpdatedExternally(
      { whiteboardId: 'wb', elements: [] as any },
      ctx,
    );

    // First delivery → restampDelta:true so the external write wins.
    expect(server.applyExternalContentUpdate).toHaveBeenCalledWith(
      'wb',
      { elements: [], files: undefined },
      { restampDelta: true },
    );
    expect(channel.ack).toHaveBeenCalledTimes(1);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('does NOT re-stamp on a redelivery (idempotent retry), then acks', async () => {
    const { controller, server } = build();
    const { ctx, channel } = makeCtx(true);

    await controller.contentUpdatedExternally(
      { whiteboardId: 'wb', elements: [] as any },
      ctx,
    );

    // Redelivery → restampDelta:false so a stale duplicate can't clobber a newer edit.
    expect(server.applyExternalContentUpdate).toHaveBeenCalledWith(
      'wb',
      { elements: [], files: undefined },
      { restampDelta: false },
    );
    expect(channel.ack).toHaveBeenCalledTimes(1);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('acks (drops) a malformed event with no whiteboardId — never requeues', async () => {
    const { controller, server } = build();
    const { ctx, channel } = makeCtx();

    await controller.contentUpdatedExternally({} as any, ctx);

    expect(server.applyExternalContentUpdate).not.toHaveBeenCalled();
    expect(channel.ack).toHaveBeenCalledTimes(1);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('nacks-with-requeue on the first failure (one bounded retry)', async () => {
    const { controller, server } = build();
    server.applyExternalContentUpdate.mockRejectedValue(new Error('db down'));
    const { ctx, channel, message } = makeCtx(false);

    await controller.contentUpdatedExternally({ whiteboardId: 'wb' }, ctx);

    expect(channel.nack).toHaveBeenCalledWith(message, false, true);
    expect(channel.ack).not.toHaveBeenCalled();
  });

  it('acks (drops) on the second failure (already redelivered) — no poison loop', async () => {
    const { controller, server } = build();
    server.applyExternalContentUpdate.mockRejectedValue(
      new Error('still down'),
    );
    const { ctx, channel, message } = makeCtx(true);

    await controller.contentUpdatedExternally({ whiteboardId: 'wb' }, ctx);

    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(channel.nack).not.toHaveBeenCalled();
  });
});
