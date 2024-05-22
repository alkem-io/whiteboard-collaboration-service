import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { setTimeout } from 'node:timers/promises';
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
import { setInterval } from 'timers';
import { arrayRandomElement } from '../util';

type SaveMessageOpts = { timeout: number };
type RoomTimers = Map<string, AbortController>;
type SocketTimers = Map<string, AbortController>;

@Injectable()
export class Server {
  private readonly wsServer: SocketIoServer;

  private readonly contributionTimers: RoomTimers = new Map();
  private readonly saveTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly collaboratorModeTimers: SocketTimers = new Map();

  private readonly contributionWindowMs: number;
  private readonly saveIntervalMs: number;
  private readonly saveTimeoutMs: number;
  private readonly collaboratorInactivityMs: number;
  private readonly maxCollaboratorsInRoom: number;

  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private logger: LoggerService,
    private readonly utilService: UtilService,
    private readonly configService: ConfigService,
  ) {
    // this.wsServer = getExcalidrawBaseServerOrFail(redisAdapterFactory);
    this.wsServer = getExcalidrawBaseServerOrFail();
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
      max_collaborators_in_room,
      } = this.configService.get('settings');
    console.table(this.configService.get('settings'));

    this.contributionWindowMs =
      (contribution_window ?? defaultContributionInterval) * 1000;
    this.saveIntervalMs = (save_interval ?? defaultSaveInterval) * 1000;
    this.saveTimeoutMs = (save_timeout ?? defaultSaveTimeout) * 1000;
    this.collaboratorInactivityMs =
      (collaborator_inactivity ?? defaultCollaboratorInactivity) * 1000;
    this.maxCollaboratorsInRoom = max_collaborators_in_room;
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

      // todo
      // const contributionTimer = this.contributionTimers.get(roomId);
      // if (!contributionTimer) {
      //   this.logger.verbose?.(
      //     `Starting contribution timer for room '${roomId}'`,
      //   );
      //   const timer = this.startContributionEventTimer(roomId);
      //   this.contributionTimers.set(roomId, timer);
      // }

      const saveTimer = this.saveTimers.get(roomId);
      if (!saveTimer) {
        this.logger.verbose?.(`Starting auto save timer for room '${roomId}'`);
        const timer = this.startSaveTimer(roomId);
        this.saveTimers.set(roomId, timer);
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
      // delete timers that were left locally
      this.deleteTimersForRoom(roomId);
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
        this.deleteCollaboratorModeTimerForSocket(socket);
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
          this.startCollaboratorModeTimer(socket);
          // user can broadcast content change events
          socket.on(SERVER_BROADCAST, (roomID: string, data: ArrayBuffer) => {
            serverBroadcastEventHandler(roomID, data, socket, (roomId) =>
              this.utilService.contentModified(socket.data.userInfo.id, roomId),
            );
            this.resetCollaboratorModeTimer(socket);
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
          this.resetCollaboratorModeTimer(socket);
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
        this.deleteCollaboratorModeTimerForSocket(socket);
      });
    });
  }

  // private startContributionEventTimer(roomId: string) {
  //   return setInterval(
  //     async () => await this.gatherContributions(roomId),
  //     this.contributionWindowMs,
  //   );
  // }

  // private async gatherContributions(roomId: string) {
  //   const windowEnd = Date.now();
  //   const windowStart = windowEnd - this.contributionWindowMs;
  //
  //   const community =
  //     await this.communityResolver.getCommunityFromWhiteboardOrFail(roomId);
  //   const spaceID =
  //     await this.communityResolver.getRootSpaceIDFromCommunityOrFail(community);
  //   const wb = await this.whiteboardService.getProfile(roomId);
  //
  //   const sockets = await this.fetchSocketsSafe(roomId);
  //
  //   for (const socket of sockets) {
  //     const lastContributed = socket.data.lastContributed;
  //     // was the last contribution in that window
  //     if (lastContributed >= windowStart && windowEnd >= lastContributed) {
  //       this.contributionReporter.whiteboardContribution(
  //         {
  //           id: roomId,
  //           name: wb.displayName,
  //           space: spaceID,
  //         },
  //         {
  //           id: socket.data.agentInfo.userID,
  //           email: socket.data.agentInfo.email,
  //         }
  //       );
  //     }
  //   }
  // }

  private startSaveTimer(roomId: string) {
    return setInterval(async () => {
      const saved = await this.sendSaveMessage(roomId, {
        timeout: this.saveTimeoutMs,
      });

      if (saved === undefined) {
        this.logger.verbose?.(`No eligible sockets found to save '${roomId}'`);
      } else if (saved) {
        this.logger.verbose?.(`Saving '${roomId}' successful`);
      } else {
        this.logger.error(`Saving '${roomId}' failed`);
      }
    }, this.saveIntervalMs);
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
      this.logger.error?.(
        `User '${randomSocketWithUpdateFlag.data.userInfo.email}' did not respond to '${SERVER_SAVE_REQUEST}' event after ${timeout}ms`,
      );
      return false;
    }

    return true;
  }

  private logResponse(
    response: SaveResponse,
    socket: RemoteSocketIoSocket,
    roomId: string,
  ) {
    if (!response.success) {
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

  private deleteTimersForRoom(roomId: string) {
    const contributionAC = this.contributionTimers.get(roomId);
    if (contributionAC) {
      contributionAC.abort('deleted');
      this.contributionTimers.delete(roomId);
      this.logger.verbose?.(`Deleted contribution timer for room '${roomId}'`);
    }

    const saveTimer = this.saveTimers.get(roomId);
    if (saveTimer) {
      clearInterval(saveTimer);
      this.saveTimers.delete(roomId);
      this.logger.verbose?.(`Deleted auto save timer for room '${roomId}'`);
    }
  }

  private createCollaboratorModeTimer(socket: SocketIoSocket) {
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
      // socket.data.update = false; // todo: if there are no sockets with update we can't save if there is something not saved
      this.collaboratorModeTimers.delete(socket.id);
    };

    const ac = new AbortController();
    // setTimeout(this.collaboratorInactivityMs, null, {
    //   signal: ac.signal,
    // })
    //   .then(() => cb())
    //   .catch((e) => {
    //     /* consume */
    //   });
    new Promise(async (res) => {
      try {
        await setTimeout(this.collaboratorInactivityMs, null, {
          signal: ac.signal,
        });
        cb();
      } catch (e) {
        if (e.name === 'AbortError') {
          this.logger.verbose?.(
            `Collaborator mode timer for user '${socket.data.userInfo.email}' was aborted`,
          );
        } else {
          this.logger.error?.(
            `Collaborator mode timer for user '${socket.data.userInfo.email}' failed: ${e.message}`,
          );
        }
      }
      res(null);
    });

    return ac;
  }

  private startCollaboratorModeTimer(socket: SocketIoSocket, logging = true) {
    // exit if already exists
    if (this.collaboratorModeTimers.get(socket.id)) {
      return;
    }
    // create new
    const abortController = this.createCollaboratorModeTimer(socket);
    this.collaboratorModeTimers.set(socket.id, abortController);
    if (logging) {
      this.logger.verbose?.(
        `Created collaborator mode timer for user '${socket.data.userInfo.email}'`,
      );
    }
  }

  private deleteCollaboratorModeTimerForSocket(
    socket: SocketIoSocket,
    logging = true,
  ) {
    const abortController = this.collaboratorModeTimers.get(socket.id);
    if (abortController) {
      abortController.abort('deleted');
      this.collaboratorModeTimers.delete(socket.id);

      if (logging) {
        this.logger.verbose?.(
          `Deleted collaborator mode timer for user '${socket.data.userInfo.email}'`,
        );
      }
    }
  }

  private resetCollaboratorModeTimer = debounce(
    (socket: SocketIoSocket) => {
      const abortController = this.collaboratorModeTimers.get(socket.id);
      if (abortController) {
        // cancel the existing one
        abortController.abort('restart');
        // delete the existing one
        this.deleteCollaboratorModeTimerForSocket(socket, false);
        // create new one
        this.startCollaboratorModeTimer(socket, false);
      }
    },
    resetCollaboratorModeDebounceWait,
    { leading: true, trailing: false },
  );
}
// not that reliable, but best we can do
const isRoomId = (id: string) => id.length === 36;
