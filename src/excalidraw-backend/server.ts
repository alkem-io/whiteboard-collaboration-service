import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { setInterval, setTimeout } from 'node:timers/promises';
import {
  Inject,
  Injectable,
  LoggerService,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { debounce, DebouncedFunc, throttle } from 'lodash';
import {
  COLLABORATOR_MODE,
  CollaboratorModeReasons,
  CONNECTION,
  defaultCollaboratorInactivity,
  defaultContributionInterval,
  defaultSaveInterval,
  DISCONNECT,
  DISCONNECTING,
  IDLE_STATE,
  INIT_ROOM,
  InMemorySnapshot,
  JOIN_ROOM,
  resetCollaboratorModeDebounceWait,
  ROOM_SAVED,
  SCENE_INIT,
  SERVER_BROADCAST,
  SERVER_SIDE_ROOM_DELETED,
  SERVER_VOLATILE_BROADCAST,
  SocketEventData,
  SocketIoServer,
  SocketIoSocket,
} from './types';
import { getExcalidrawBaseServerOrFail } from './index';
import {
  attachUserInfoOrFailMiddleware,
  initUserDataMiddleware,
} from './middlewares';
import { UserInfo } from '../services/whiteboard-integration/user.info';
import { UtilService } from '../services/util/util.service';
import {
  authorizeWithRoomAndJoinHandler,
  closeConnection,
  DeepReadonly,
  disconnectEventHandler,
  disconnectingEventHandler,
  idleStateEventHandler,
  isRoomId,
  prepareContentForSave,
  serverBroadcastEventHandler,
  serverVolatileBroadcastEventHandler,
} from './utils';
import { CREATE_ROOM, DELETE_ROOM } from './adapters/adapter.event.names';
import { APP_ID } from '../app.id';
import { isAbortError, jsonToArrayBuffer } from '../util';
import { ConfigType } from '../config';
import { tryDecodeIncoming } from './utils/decode.incoming';
import { SceneInitPayload, ServerBroadcastPayload } from './types/events';
import { ExcalidrawElement, ExcalidrawFileStore } from '../excalidraw/types';
import { isSaveErrorData } from '../services/whiteboard-integration/outputs';

type RoomTrackers = Map<string, AbortController>;
type SocketTrackers = Map<string, AbortController>;
type SaveRoomFunction = (roomId: string) => Promise<void>;

type ThrottledFunc<T extends (...args: any[]) => any> = DebouncedFunc<T>;
type ThrottledSaveFunction = ThrottledFunc<SaveRoomFunction>;
type ThrottledSaveFunctionMap = Map<string, ThrottledSaveFunction>;

@Injectable()
export class Server {
  private readonly wsServer: SocketIoServer;

  private readonly contributionTrackers: RoomTrackers = new Map();
  private readonly collaboratorInactivityTrackers: SocketTrackers = new Map();
  // todo: try WeakMap or better yet - WeakSet
  private readonly throttledSaveFnMap: ThrottledSaveFunctionMap = new Map();

  private readonly contributionWindowMs: number;
  private readonly saveIntervalMs: number;
  private readonly collaboratorInactivityMs: number;

  private snapshots: Map<string, InMemorySnapshot> = new Map();

  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private logger: LoggerService,
    private readonly utilService: UtilService,
    private readonly configService: ConfigService<ConfigType, true>,
  ) {
    const port = this.configService.get('settings.collaboration.port', {
      infer: true,
    });
    // this.wsServer = getExcalidrawBaseServerOrFail(redisAdapterFactory);
    this.wsServer = getExcalidrawBaseServerOrFail(port, logger);
    // don't block the constructor
    this.init()
      .then(() =>
        this.logger.verbose?.('Excalidraw server initialized and running'),
      )
      .catch((err) => this.logger.error(err));

    const { contribution_window, save_interval, collaborator_inactivity } =
      this.configService.get('settings.collaboration', { infer: true });

    this.contributionWindowMs =
      (contribution_window ?? defaultContributionInterval) * 1000;
    this.collaboratorInactivityMs =
      (collaborator_inactivity ?? defaultCollaboratorInactivity) * 1000;

    this.saveIntervalMs = save_interval ?? defaultSaveInterval;
  }

  private async fetchSocketsSafe(roomID: string) {
    try {
      return await this.wsServer.in(roomID).fetchSockets();
    } catch (e: any) {
      this.logger.warn(`fetchSockets error handled: ${e?.message}`);
      return [];
    }
  }

  private adapterInit() {
    const adapter = this.wsServer.of('/').adapter;
    adapter.on(CREATE_ROOM, async (roomId: string) => {
      if (!isRoomId(roomId)) {
        return;
      }

      if ((await this.fetchSocketsSafe(roomId)).length > 0) {
        // if there are sockets already connected
        // this room already exist on another instance
        return;
      }
      this.logger.verbose?.(`Room '${roomId}' created on instance '${APP_ID}'`);

      const contributionAC = this.contributionTrackers.get(roomId);
      if (!contributionAC) {
        this.logger.verbose?.(
          `Starting contribution tracker for room '${roomId}'`,
        );
        const ac = this.startContributionTrackerForRoom(roomId);
        this.contributionTrackers.set(roomId, ac);
      }

      this.createAndStoreThrottledSaveAndNotifyRoom(
        roomId,
        this.saveIntervalMs,
      );
    });
    adapter.on(DELETE_ROOM, async (roomId: string) => {
      if (!isRoomId(roomId)) {
        return;
      }

      const connectedSocketsToRoomCount = (await this.fetchSocketsSafe(roomId))
        .length;
      if (connectedSocketsToRoomCount > 0) {
        // if there are sockets already connected
        // this room was deleted, but it's still active on the other instances
        // so do nothing here
        this.logger.verbose?.(
          `Room '${roomId}' deleted locally ('${APP_ID}'), but ${connectedSocketsToRoomCount} sockets are still connected elsewhere`,
        );
        return;
      }
      // send an event that the room is actually deleted everywhere,
      // because this was the last one
      this.wsServer.serverSideEmit(SERVER_SIDE_ROOM_DELETED, APP_ID, roomId);

      this.logger.verbose?.(
        `Room '${roomId}' deleted locally and everywhere else - this was the final instance`,
      );
      // delete trackers that were left locally
      this.deleteTrackersForRoom(roomId);
      // execute immediately the queued call (if any)
      await this.flushThrottledSave(roomId);
      // delete the throttled save function
      this.cancelThrottledSave(roomId);
      // todo: should we keep it cached?
      this.snapshots.delete(roomId);
    });
    adapter.on('error', (error: Error) => {
      this.logger.error(error, error.stack);
    });
  }

  private async init() {
    this.adapterInit();
    // middlewares
    this.wsServer.use(initUserDataMiddleware);
    this.wsServer.use(
      attachUserInfoOrFailMiddleware(this.getUserInfo.bind(this)),
    );

    this.wsServer.on(CONNECTION, async (socket: SocketIoSocket) => {
      this.logger.verbose?.(
        `User '${socket.data.userInfo.email}' established connection`,
      );

      this.wsServer.to(socket.id).emit(INIT_ROOM);
      // attach error handlers
      socket.on('error', (err) => {
        if (!err) {
          return;
        }

        this.logger.error(err);

        if (err && err instanceof UnauthorizedException) {
          closeConnection(socket, err.message);
          this.deleteCollaboratorInactivityTrackerForSocket(socket);
        }
      });

      socket.on(JOIN_ROOM, async (roomID) => {
        await this.loadSnapshot(roomID);

        // this logic could be provided by an entitlement (license) service
        await authorizeWithRoomAndJoinHandler(
          roomID,
          socket,
          this.wsServer,
          this.logger,
          (roomId, userId) =>
            this.utilService.getUserInfoForRoom(userId, roomId),
        );
        await this.initSceneForSocket(socket, roomID);

        if (socket.data.collaborator) {
          this.startCollaboratorInactivityTrackerForSocket(socket);
          // user can broadcast content change events
          socket.on(
            SERVER_BROADCAST,
            async (roomID: string, data: ArrayBuffer) => {
              serverBroadcastEventHandler(roomID, data, socket, (roomId) =>
                this.utilService.contentModified(
                  socket.data.userInfo.id,
                  roomId,
                ),
              );
              this.resetCollaboratorInactivityTrackerForSocket(socket);
              // todo extract to a function
              let eventData:
                | SocketEventData<ServerBroadcastPayload>
                | undefined;
              try {
                eventData = tryDecodeIncoming<ServerBroadcastPayload>(data);
              } catch (e) {
                this.logger.error({
                  message: e?.message ?? JSON.stringify(e),
                });
              }
              if (!eventData) {
                return;
              }

              this.utilService.reportChanges(
                roomID,
                socket.data.userInfo.email,
                (this.snapshots.get(roomID)?.content.elements ??
                  []) as ExcalidrawElement[],
                eventData.payload.elements as ExcalidrawElement[],
              );

              this.createAndStoreLatestSnapshot(
                roomID,
                eventData.payload.elements,
                eventData.payload.files,
              );

              this.queueSave(roomID);
            },
          );
        }
        this.logger.verbose?.(
          `User '${socket.data.userInfo.email}' read=${socket.data.viewer}, update=${socket.data.collaborator}`,
        );
      });

      socket.on(
        SERVER_VOLATILE_BROADCAST,
        (roomID: string, data: ArrayBuffer) => {
          serverVolatileBroadcastEventHandler(roomID, data, socket);
          this.resetCollaboratorInactivityTrackerForSocket(socket);
        },
      );

      socket.on(IDLE_STATE, (roomID: string, data: ArrayBuffer) =>
        idleStateEventHandler(roomID, data, socket, this.logger),
      );

      socket.on(
        DISCONNECTING,
        async () =>
          await disconnectingEventHandler(this.wsServer, socket, this.logger),
      );
      socket.on(DISCONNECT, () => {
        disconnectEventHandler(socket);
        this.deleteCollaboratorInactivityTrackerForSocket(socket);
      });
    });
  }

  private startContributionTrackerForRoom(roomId: string) {
    const ac = new AbortController();

    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of setInterval(this.contributionWindowMs, null, {
        signal: ac.signal,
      })) {
        await this.gatherContributions(roomId);
      }
    })().catch((e) => {
      if (isAbortError(e)) {
        this.logger.verbose?.(
          `Contribution tracker for room '${roomId}' was aborted with reason '${e.cause}'`,
        );
      } else {
        this.logger.error?.(
          `Contribution tracker for room '${roomId}' failed: ${e.message}`,
        );
      }
    });

    return ac;
  }

  private async gatherContributions(roomId: string) {
    const windowEnd = Date.now();
    const windowStart = windowEnd - this.contributionWindowMs;

    const sockets = await this.fetchSocketsSafe(roomId);

    const users = sockets
      .map((socket) => {
        const lastContributed = socket.data.lastContributed;
        if (lastContributed >= windowStart && windowEnd >= lastContributed) {
          return {
            id: socket.data.userInfo.id,
            email: socket.data.userInfo.email,
          };
        }
      })
      .filter((item): item is { id: string; email: string } => !!item);

    this.logger.verbose?.(
      `Registering contributions for ${users.length} users in room '${roomId}'`,
    );
    return this.utilService.contribution(roomId, users);
  }

  private createAndStoreLatestSnapshot(
    roomId: string,
    remoteElements: readonly ExcalidrawElement[],
    remoteFileStore: DeepReadonly<ExcalidrawFileStore>,
  ) {
    const oldSnapshot = this.snapshots.get(roomId);
    if (!oldSnapshot) {
      return;
    }

    const reconciledSnapshot = InMemorySnapshot.reconcile(
      oldSnapshot,
      remoteElements,
      remoteFileStore,
    );
    this.snapshots.set(roomId, reconciledSnapshot);
  }

  private getUserInfo(socket: SocketIoSocket): Promise<UserInfo | undefined> {
    return this.utilService.getUserInfo({
      authorization: socket.handshake.headers.authorization,
      cookie: socket.handshake.headers.cookie,
    });
  }

  private deleteTrackersForRoom(roomId: string) {
    const contributionAC = this.contributionTrackers.get(roomId);
    if (contributionAC) {
      contributionAC.abort('deleted');
      this.contributionTrackers.delete(roomId);
      this.logger.verbose?.(
        `Deleted contribution tracker for room '${roomId}'`,
      );
    }
  }

  private createCollaboratorInactivityTracker(socket: SocketIoSocket) {
    const cb = () => {
      this.logger.verbose?.(
        `User '${socket.data.userInfo.email}' was inactive ${this.collaboratorInactivityMs / 1000} seconds, setting collaborator mode to 'read' for user '${socket.data.userInfo.email}'`,
      );
      // User is inactive, setting collaborator mode to 'read'
      // todo move emit, removeAllListeners, socket.data
      this.wsServer.to(socket.id).emit(COLLABORATOR_MODE, {
        mode: 'read',
        reason: CollaboratorModeReasons.INACTIVITY,
      });
      socket.removeAllListeners(SERVER_BROADCAST);
      // if there are no sockets with update we can't save if there is something not saved
      // socket.data.update = false;
      this.collaboratorInactivityTrackers.delete(socket.id);
    };

    const ac = new AbortController();
    (async () => {
      await setTimeout(this.collaboratorInactivityMs, null, {
        signal: ac.signal,
      });
      cb();
    })().catch((e) => {
      if (isAbortError(e)) {
        this.logger.verbose?.(
          `Collaborator inactivity tracker for user '${socket.data.userInfo.email}' was aborted with reason '${e.cause}'`,
        );
      } else {
        this.logger.error?.(
          `Collaborator inactivity tracker for user '${socket.data.userInfo.email}' failed: ${e.message}`,
        );
      }
    });

    return ac;
  }

  private startCollaboratorInactivityTrackerForSocket(
    socket: SocketIoSocket,
    logging = true,
  ) {
    // exit if already exists
    if (this.collaboratorInactivityTrackers.get(socket.id)) {
      return;
    }
    // create new
    const abortController = this.createCollaboratorInactivityTracker(socket);
    this.collaboratorInactivityTrackers.set(socket.id, abortController);
    if (logging) {
      this.logger.verbose?.(
        `Created collaborator inactivity tracker for user '${socket.data.userInfo.email}'`,
      );
    }
  }

  private deleteCollaboratorInactivityTrackerForSocket(
    socket: SocketIoSocket,
    logging = true,
  ) {
    const abortController = this.collaboratorInactivityTrackers.get(socket.id);
    if (abortController) {
      abortController.abort('deleted');
      this.collaboratorInactivityTrackers.delete(socket.id);

      if (logging) {
        this.logger.verbose?.(
          `Deleted collaborator inactivity tracker for user '${socket.data.userInfo.email}'`,
        );
      }
    }
  }
  // todo: do it without abort controller
  private resetCollaboratorInactivityTrackerForSocket = debounce(
    (socket: SocketIoSocket) => {
      const abortController = this.collaboratorInactivityTrackers.get(
        socket.id,
      );
      if (abortController) {
        // cancel the existing one
        abortController.abort('restart');
        // delete the existing one
        this.deleteCollaboratorInactivityTrackerForSocket(socket, false);
        // create new one
        this.startCollaboratorInactivityTrackerForSocket(socket, false);
      }
    },
    resetCollaboratorModeDebounceWait,
    { leading: true, trailing: false },
  );

  public async initSceneForSocket(socket: SocketIoSocket, roomId: string) {
    const snapshot = await this.loadSnapshot(roomId);
    const data: SceneInitPayload = {
      type: SCENE_INIT,
      payload: {
        elements: snapshot.content.elements,
        files: snapshot.content.files,
      },
    };
    this.wsServer.to(socket.id).emit(SCENE_INIT, jsonToArrayBuffer(data));
    this.logger.verbose?.(`Scene init sent to '${socket.data.userInfo.email}'`);
  }

  // todo: move to a helper class
  private queueSave(roomId: string) {
    const throttledSave = this.throttledSaveFnMap.get(roomId);
    if (!throttledSave) {
      // will produce too much logging
      return;
    }

    throttledSave(roomId);
  }
  /**
   *  Creates a new throttled save function for a room and stores it in  __throttledSaveFnMap__.</br>
   *  Called once immediately on the first invocation, then once after __wait__ milliseconds; Guaranteed save every __maxWait__ milliseconds;</br>
   *  To be used when the room is created, and used only for that room.</br>
   *  Use __cancelThrottledSave__ to cancel this function.</br>
   *  Use __flushThrottledSave__ to invoke this function immediately.
   */
  private createAndStoreThrottledSaveAndNotifyRoom(
    roomId: string,
    wait: number,
  ): ThrottledSaveFunction {
    const throttledSave = throttle(
      async (roomId: string) => {
        const hasSaved = await this.saveRoom(roomId);

        if (hasSaved) {
          this.notifyRoomSaved(roomId);
        }
      },
      wait,
      { leading: false, trailing: true },
    );
    this.throttledSaveFnMap.set(roomId, throttledSave);

    this.logger.verbose?.(`Throttled save just created for '${roomId}'`);

    return throttledSave;
  }

  private cancelThrottledSave(roomId: string) {
    const throttledSaveFn = this.throttledSaveFnMap.get(roomId);

    if (!throttledSaveFn) {
      this.logger.error(
        `No throttled save function found for room '${roomId}'`,
      );
      return;
    }

    throttledSaveFn.cancel();

    this.logger.verbose?.(`Throttled save just canceled for '${roomId}'`);
  }

  private async flushThrottledSave(roomId: string) {
    const throttledSaveFn = this.throttledSaveFnMap.get(roomId);

    if (!throttledSaveFn) {
      this.logger.error(
        `No throttled save function found for room '${roomId}'`,
      );
      return;
    }

    this.logger.verbose?.(`Throttled save just flushed for '${roomId}'`);
    await throttledSaveFn.flush();
  }

  private notifyRoomSaved(roomId: string) {
    this.wsServer.in(roomId).emit(ROOM_SAVED);
  }
  /**
   * Loads the snapshot in the in-memory Map and returns it.
   * The snapshot is loaded from the DB if it's not found in the Map.
   * @param roomId
   * @returns The snapshot
   */
  private async loadSnapshot(roomId: string) {
    const snapshotContent = this.snapshots.get(roomId);

    if (!snapshotContent) {
      const fetchedContent =
        await this.utilService.fetchContentFromDbOrEmpty(roomId);

      const newSnapshot = new InMemorySnapshot(fetchedContent, 1);
      this.snapshots.set(roomId, newSnapshot);

      return newSnapshot;
    }

    return snapshotContent;
  }

  private async saveRoom(roomId: string): Promise<boolean> {
    const snapshot = this.snapshots.get(roomId);
    if (!snapshot) {
      this.logger.error(
        `No snapshot found for room '${roomId}' in the local storage!`,
      );
      return false;
    }

    const cleanContent = prepareContentForSave(snapshot);
    const { data } = await this.utilService.save(roomId, cleanContent);
    if (isSaveErrorData(data)) {
      this.logger.error(`Failed to save room '${roomId}': ${data.error}`);
      return false;
    } else {
      this.logger.verbose?.(`Room '${roomId}' saved successfully`);
      return true;
    }
  }
}
