import { RemoteSocket, Socket } from 'socket.io';
import {
  DefaultEventsMap,
  EventNames,
  ReservedOrUserListener,
} from 'socket.io/dist/typed-events';
import { SocketData } from './socket.data';
import {
  CLIENT_BROADCAST,
  DISCONNECT,
  DISCONNECTING,
  IDLE_STATE,
  SCENE_INIT,
  JOIN_ROOM,
  ROOM_USER_CHANGE,
  SERVER_BROADCAST,
  SERVER_VOLATILE_BROADCAST,
  ERROR,
} from './event.names';

type ListenEvents = {
  [JOIN_ROOM]: (roomId: string) => void;
  [SCENE_INIT]: (roomId: string, data: ArrayBuffer) => void;
  [SERVER_BROADCAST]: (roomId: string, data: ArrayBuffer) => void;
  [SERVER_VOLATILE_BROADCAST]: (roomId: string, data: ArrayBuffer) => void;
  [IDLE_STATE]: (roomId: string, data: ArrayBuffer) => void;
};

type EmitEvents = {
  [CLIENT_BROADCAST]: (data: ArrayBuffer) => void;
  [IDLE_STATE]: (data: ArrayBuffer) => void;
  [ROOM_USER_CHANGE]: (socketIds: Array<string>) => void;
  [ERROR]: ({
    code,
    description,
  }: {
    code: number;
    description: string;
  }) => void;
};
type ServerSideEvents = DefaultEventsMap;

export type SocketIoSocket = Socket<
  ListenEvents,
  EmitEvents,
  ServerSideEvents,
  SocketData
>;

// export type SocketHandlers = ReservedOrUserListener<ReservedEvents, ListenEvents, Ev>
export type SocketHandlers = ReservedOrUserListener<
  Record<string, never>,
  ListenEvents,
  EventNames<ListenEvents>
>;

export type RemoteSocketIoSocket = RemoteSocket<EmitEvents, SocketData>;
