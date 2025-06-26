import { Server } from 'socket.io';
import { SocketData } from './socket.data';
import {
  CLIENT_BROADCAST,
  COLLABORATOR_MODE,
  CONNECTION,
  IDLE_STATE,
  INIT_ROOM,
  ROOM_USER_CHANGE,
  ROOM_SAVED,
  SCENE_INIT,
  SERVER_BROADCAST,
  SERVER_SIDE_ROOM_DELETED,
  SERVER_VOLATILE_BROADCAST,
  ROOM_NOT_SAVED,
  PING,
} from './event.names';
import { SocketIoSocket } from './socket.io.socket';
import { CollaboratorModeReasons } from './collaboration.mode.reasons';

type ListenEvents = {
  [CONNECTION]: (socket: SocketIoSocket) => void;
  [IDLE_STATE]: (roomId: string, data: ArrayBuffer) => void;
  [SERVER_BROADCAST]: (roomId: string, data: ArrayBuffer) => void;
  [SERVER_VOLATILE_BROADCAST]: (roomId: string, data: ArrayBuffer) => void;
  [SERVER_SIDE_ROOM_DELETED]: (serverId: string, roomId: string) => void;
  [PING]: (cb: () => void) => void;
};
type EmitEvents = {
  [INIT_ROOM]: () => void;
  [CLIENT_BROADCAST]: (data: ArrayBuffer) => void;
  [ROOM_USER_CHANGE]: (socketIDs: Array<string>) => void;
  [SCENE_INIT]: (scene: ArrayBuffer) => void;
  [ROOM_SAVED]: () => void;
  [ROOM_NOT_SAVED]: ({ error }: { error: string }) => void;
  [COLLABORATOR_MODE]: (data: {
    mode: 'read' | 'write';
    reason?: CollaboratorModeReasons;
  }) => void;
};
type ServerSideEvents = {
  [SERVER_SIDE_ROOM_DELETED]: (serverId: string, roomId: string) => void;
};

export type SocketIoServer = Server<
  ListenEvents,
  EmitEvents,
  ServerSideEvents,
  SocketData
>;
