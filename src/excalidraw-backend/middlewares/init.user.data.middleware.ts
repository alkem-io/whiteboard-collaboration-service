import { SocketIoSocket } from '../types';
import { SimpleMiddlewareHandler } from './middleware.handler.type';

export const initUserDataMiddleware: SimpleMiddlewareHandler = (
  socket: SocketIoSocket,
  next: (err?: Error) => void,
) => {
  socket.data.userInfo = { id: 'not-initialized', email: 'not-initialized' };
  socket.data.lastContributed = -1;
  socket.data.lastPresence = -1;

  socket.data.read = false;
  socket.data.update = false;

  socket.data.session = undefined;

  next();
};
