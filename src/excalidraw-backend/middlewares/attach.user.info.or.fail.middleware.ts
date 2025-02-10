import { UserInfo } from '../../services/whiteboard-integration/user.info';
import { SocketIoSocket, ERROR_EVENTS } from '../types';
import { WrappedMiddlewareHandler } from './middleware.handler.type';

export const attachUserInfoOrFailMiddleware: WrappedMiddlewareHandler =
  (getter: (socket: SocketIoSocket) => Promise<UserInfo>) =>
  async (socket, next) => {
    try {
      socket.data.userInfo = await getter(socket);
    } catch (e: any) {
      socket.emit('error', ERROR_EVENTS.USER_INFO_NO_VERIFY);
      // no handlers for the exception below - it is handled by socket.io
      next(new Error('Disconnected with error'));
    }

    next();
  };
