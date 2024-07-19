import { SocketIoSocket } from '../types';
import { UserIdleState } from '../types/user.idle.state';
import { SimpleMiddlewareHandler } from './middleware.handler.type';

export const initUserDataMiddleware: SimpleMiddlewareHandler = (
  socket: SocketIoSocket,
  next: (err?: Error) => void,
) => {
  socket.data.userInfo = { id: 'not-initialized', email: 'not-initialized' };
  socket.data.lastContributed = -1;
  socket.data.lastPresence = -1;

  socket.data.read = false;
  socket.data.collaborator = false;

  socket.data.state = UserIdleState.ACTIVE;

  socket.data.failedSaves = 0;
  socket.data.canSave = false;

  socket.data.session = undefined;

  next();
};
