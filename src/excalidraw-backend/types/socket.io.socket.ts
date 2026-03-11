import { RemoteSocket, Socket } from 'socket.io';
import {
  DefaultEventsMap,
  EventNames,
  ReservedOrUserListener,
} from 'socket.io/dist/typed-events';
import {
  CLIENT_BROADCAST,
  CONNECTION_CLOSED,
  ERROR,
  IDLE_STATE,
  JOIN_ROOM,
  PING,
  ROOM_USER_CHANGE,
  SCENE_INIT,
  SERVER_BROADCAST,
  SERVER_VOLATILE_BROADCAST,
} from './event.names';
import { SocketData } from './socket.data';

type ListenEvents = {
  [JOIN_ROOM]: (roomId: string) => void;
  [SCENE_INIT]: (roomId: string, data: ArrayBuffer) => void;
  [SERVER_BROADCAST]: (roomId: string, data: ArrayBuffer) => void;
  [SERVER_VOLATILE_BROADCAST]: (roomId: string, data: ArrayBuffer) => void;
  [IDLE_STATE]: (roomId: string, data: ArrayBuffer) => void;
  [PING]: (ack: () => void) => void;
};

type EmitEvents = {
  [CLIENT_BROADCAST]: (data: ArrayBuffer) => void;
  [IDLE_STATE]: (data: ArrayBuffer) => void;
  [ROOM_USER_CHANGE]: (socketIds: Array<string>) => void;
  [CONNECTION_CLOSED]: (message?: string) => void;
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

export type SocketHandlers = ReservedOrUserListener<
  Record<string, never>,
  ListenEvents,
  EventNames<ListenEvents>
>;

export type RemoteSocketIoSocket = RemoteSocket<EmitEvents, SocketData>;
