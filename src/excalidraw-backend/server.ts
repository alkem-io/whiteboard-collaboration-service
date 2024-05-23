import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { setTimeout, setInterval } from 'node:timers/promises';
import {
  Inject,
  Injectable,
  LoggerService,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { debounce } from 'lodash';
import {
  CLIENT_BROADCAST,
  COLLABORATOR_MODE,
  CollaboratorModeReasons,
  CONNECTION,
  defaultCollaboratorInactivity,
  defaultContributionInterval,
  defaultSaveInterval,
  defaultSaveTimeout,
  DISCONNECT,
  DISCONNECTING,
  IDLE_STATE,
  INIT_ROOM,
  JOIN_ROOM,
  RemoteSocketIoSocket,
  resetCollaboratorModeDebounceWait,
  SaveResponse,
  SCENE_INIT,
  SERVER_BROADCAST,
  SERVER_SAVE_REQUEST,
  SERVER_SIDE_ROOM_DELETED,
  SERVER_VOLATILE_BROADCAST,
  SocketIoServer,
  SocketIoSocket,
} from './types';
import { getExcalidrawBaseServerOrFail } from './index';
import {
  attachUserInfoMiddleware,
  initUserDataMiddleware,
} from './middlewares';
import { UserInfo } from '../services/whiteboard-integration/user.info';
import { UtilService } from '../services/util/util.service';
import {
  authorizeWithRoomAndJoinHandler,
  closeConnection,
  disconnectEventHandler,
  disconnectingEventHandler,
  idleStateEventHandler,
  serverBroadcastEventHandler,
  serverVolatileBroadcastEventHandler,
} from './utils';
import { CREATE_ROOM, DELETE_ROOM } from './adapters/adapter.event.names';
import { APP_ID } from '../app.id';
import { arrayRandomElement, isAbortError } from '../util';
import { ConfigType } from '../config';

type SaveMessageOpts = { timeout: number };
type RoomTrackers = Map<string, AbortController>;
type SocketTrackers = Map<string, AbortController>;

@Injectable()
export class Server {
  private readonly wsServer: SocketIoServer;

  private readonly contributionTrackers: RoomTrackers = new Map();
  private readonly autoSaveTrackers: RoomTrackers = new Map();
  private readonly collaboratorInactivityTrackers: SocketTrackers = new Map();

  private readonly contributionWindowMs: number;
  private readonly saveIntervalMs: number;
  private readonly saveTimeoutMs: number;
  private readonly collaboratorInactivityMs: number;

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
      .catch(this.logger.error);

    const {
      contribution_window,
      save_interval,
      save_timeout,
      collaborator_inactivity,
    } = this.configService.get('settings.collaboration', { infer: true });

    this.contributionWindowMs =
      (contribution_window ?? defaultContributionInterval) * 1000;
    this.saveIntervalMs = (save_interval ?? defaultSaveInterval) * 1000;
    this.saveTimeoutMs = (save_timeout ?? defaultSaveTimeout) * 1000;
    this.collaboratorInactivityMs =
      (collaborator_inactivity ?? defaultCollaboratorInactivity) * 1000;
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

      const autosaveTracker = this.autoSaveTrackers.get(roomId);
      if (!autosaveTracker) {
        this.logger.verbose?.(
          `Starting auto save tracker for room '${roomId}'`,
        );
        const ac = this.startAutoSaveTrackerForRoom(roomId);
        this.autoSaveTrackers.set(roomId, ac);
      }
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
    });
    adapter.on('error', (error: Error) => {
      this.logger.error(error, error.stack);
    });
  }

  private async init() {
    this.adapterInit();
    // middlewares
    this.wsServer.use(initUserDataMiddleware);
    this.wsServer.use(attachUserInfoMiddleware(this.getUserInfo.bind(this)));

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

        // this.logger.error(err.message, err.stack, LogContext.EXCALIDRAW_SERVER);
        console.error(err);

        if (err && err instanceof UnauthorizedException) {
          closeConnection(socket, err.message);
        }
        this.deleteCollaboratorInactivityTrackerForSocket(socket);
      });

      socket.on(JOIN_ROOM, async (roomID) => {
        // this logic could be provided by an entitlement (license) service
        await authorizeWithRoomAndJoinHandler(
          roomID,
          socket,
          this.wsServer,
          this.logger,
          (roomId, userId) =>
            this.utilService.getUserInfoForRoom(userId, roomId),
        );

        if (socket.data.update) {
          this.startCollaboratorInactivityTrackerForSocket(socket);
          // user can broadcast content change events
          socket.on(SERVER_BROADCAST, (roomID: string, data: ArrayBuffer) => {
            serverBroadcastEventHandler(roomID, data, socket, (roomId) =>
              this.utilService.contentModified(socket.data.userInfo.id, roomId),
            );
            this.resetCollaboratorInactivityTrackerForSocket(socket);
          });
          socket.on(SCENE_INIT, (roomID: string, data: ArrayBuffer) => {
            socket.broadcast.to(roomID).emit(CLIENT_BROADCAST, data);
          });
        }
        this.logger.verbose?.(
          `User '${socket.data.userInfo.email}' read=${socket.data.read}, update=${socket.data.update}`,
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
        idleStateEventHandler(roomID, data, socket),
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

  private startAutoSaveTrackerForRoom(roomId: string) {
    const ac = new AbortController();
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of setInterval(this.saveIntervalMs, null, {
        signal: ac.signal,
      })) {
        const saved = await this.sendSaveMessage(roomId, {
          timeout: this.saveTimeoutMs,
        });

        if (saved === undefined) {
          this.logger.verbose?.(
            `No eligible sockets found to save '${roomId}'`,
          );
        } else if (saved) {
          this.logger.verbose?.(`Saving '${roomId}' successful`);
        } else {
          this.logger.error(`Saving '${roomId}' failed`);
        }
      }
    })().catch((e) => {
      if (isAbortError(e)) {
        this.logger.verbose?.(
          `Auto save tracker for room '${roomId}' was aborted with reason '${e.cause}'`,
        );
      } else {
        this.logger.error?.(
          `Auto save tracker for room '${roomId}' failed: ${e.message}`,
        );
      }
    });

    return ac;
  }

  /***
   * Sends save requests to a random sockets until it's successful after a fixed set of retries
   *
   * @param roomId The room that needs saving
   * @param opts Save options
   */
  private async sendSaveMessage(
    roomId: string,
    opts: SaveMessageOpts,
  ): Promise<boolean | undefined> {
    const { timeout } = opts;
    // get only sockets which can save
    const sockets = (await this.fetchSocketsSafe(roomId)).filter(
      (socket) => socket.data.update,
    );
    // return if no eligible sockets
    if (!sockets.length) {
      return undefined;
    }
    // choose a random socket which can save
    const randomSocketWithUpdateFlag = arrayRandomElement(sockets);
    // sends a save request to the socket and wait for a response
    try {
      // we are waiting for a single response, so destruct to just the first element
      const [response] = await this.wsServer
        .to(randomSocketWithUpdateFlag.id)
        .timeout(timeout)
        .emitWithAck(SERVER_SAVE_REQUEST);
      // log the response
      this.logResponse(response, randomSocketWithUpdateFlag, roomId);
    } catch (e) {
      if (this.autoSaveTrackers.get(roomId)) {
        // avoid false-positives where the room is deleted and the save request is still running
        this.logger.error?.(
          `User '${randomSocketWithUpdateFlag.data.userInfo.email}' did not respond to '${SERVER_SAVE_REQUEST}' event after ${timeout}ms`,
        );
      }
      return false;
    }

    return true;
  }

  private logResponse(
    response: SaveResponse,
    socket: RemoteSocketIoSocket,
    roomId: string,
  ) {
    if (!response.success && this.autoSaveTrackers.get(roomId)) {
      // avoid false-positives where the room is deleted and the save request is still running
      this.logger.error(
        `User ${
          socket.data.userInfo.email
        } failed to save whiteboard '${roomId}': ${response.errors?.join(
          '; ',
        )}`,
      );
    } else if (response.errors) {
      this.logger.warn(
        `User '${
          socket.data.userInfo.email
        }' saved Whiteboard '${roomId}' with some errors: ${response.errors?.join(
          ';',
        )}'`,
      );
    }
  }

  private getUserInfo(socket: SocketIoSocket): Promise<UserInfo | undefined> {
    return this.utilService.getUserInfo({
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

    const saveAC = this.autoSaveTrackers.get(roomId);
    if (saveAC) {
      saveAC.abort('deleted');
      this.autoSaveTrackers.delete(roomId);
      this.logger.verbose?.(`Deleted auto save tracker for room '${roomId}'`);
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
}
// not that reliable, but best we can do
const isRoomId = (id: string) => id.length === 36;
