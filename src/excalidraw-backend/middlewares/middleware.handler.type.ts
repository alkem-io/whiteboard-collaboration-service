import { ExtendedError } from 'socket.io';
import { SocketIoSocket } from '../types';

export type SimpleMiddlewareHandler = (
  socket: SocketIoSocket,
  next: (err?: ExtendedError) => void,
) => Awaited<void>;

export type WrappedMiddlewareHandler = (
  ...args: any[]
) => SimpleMiddlewareHandler;
