import { UnauthorizedException } from '@nestjs/common';
import { WrappedMiddlewareHandler } from './middleware.handler.type';
import { UserInfo } from '../../services/whiteboard-integration/user.info';
import { SocketIoSocket } from '../types';

export const attachUserInfoOrFailMiddleware: WrappedMiddlewareHandler =
  (getter: (socket: SocketIoSocket) => Promise<UserInfo>) =>
  async (socket, next) => {
    try {
      socket.data.userInfo = await getter(socket);
    } catch (e: any) {
      next(
        new UnauthorizedException(
          `Error while trying to get user info: ${e.message}`,
        ),
      );
    }

    next();
  };
